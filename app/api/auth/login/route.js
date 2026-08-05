// app/api/auth/login/route.js
import { prisma } from "../../../../prisma/prisma";
import { logActivity } from "../../../lib/logger";
import { SignJWT } from "jose";
import { sendFailedLoginAlert } from '../../../lib/email_notification';
import bcrypt from 'bcrypt';

export async function POST(request) {
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";

  try {
    const req = await request.json();
    const { email, password } = req;

    console.log("email for debug only:", email);

    if (!email || !password) {
      return Response.json(
        { success: false, message: "Missing Email or Password" },
        { status: 400 }
      );
    }

    const usersWithThisEmail = await prisma.user.findMany({
      where: { 
        email: email
      },
    });

    // case a: invalid email
    if (usersWithThisEmail.length === 0) {
      await prisma.loginLog.create({
        data: { email: email, status: "FAILURE", ip_address: ip }
      });

      try {
        await logActivity({ req: request, userId: null, email, action: "LOGIN_FAILURE", details: JSON.stringify({ ip }) });
      } catch (err) {
        console.error("Failed to log activity (login failure):", err);
      }

      return Response.json(
        { success: false, message: "Invalid Email or Password" },
        { status: 401 }
      );
    }

    // kanino password
    let authenticatedUser = null;

    // for (const currentUser of usersWithThisEmail) {
    //   // 📝 Paalala: Kung naka-bcrypt ka na, palitan mo ito ng: await bcrypt.compare(password, currentUser.password)
    //   if (currentUser.password === password) {
    //     authenticatedUser = currentUser;
    //     break;
    //   }
    // }

    for (const currentUser of usersWithThisEmail) {
      // 🔐 Check if stored password is hashed (starts with $2b$)
      const isHashed = currentUser.password && currentUser.password.startsWith('$2b$');
      let passwordMatches = false;

      if (isHashed) {
        // Compare with bcrypt
        passwordMatches = await bcrypt.compare(password, currentUser.password);
      } else {
        // Plain-text fallback (for old accounts)
        passwordMatches = (currentUser.password === password);
        // If plain matches, upgrade to hash immediately
        if (passwordMatches) {
          const hashed = await bcrypt.hash(password, 12);
          await prisma.user.update({
            where: { id: currentUser.id },
            data: { password: hashed }
          });
        }
      }

      if (passwordMatches) {
        authenticatedUser = currentUser;
        break;
      }
    }

    if (authenticatedUser.disabled) {
      await logActivity({
        req: request,
        userId: authenticatedUser.id,
        email: authenticatedUser.email,
        action: "LOGIN_FAILURE",
        details: JSON.stringify({ reason: "Account disabled", ip })
      });
      return Response.json(
        { success: false, message: "Account is disabled. If this is not supposed to happen, please contact your department head, or NCST D-Forms Administrators." },
        { status: 401 }
      );
    }

    // case b: tama email mali password
    if (!authenticatedUser) {
      let maxFailedAttempts = 0;

      for (const currentUser of usersWithThisEmail) {
        await prisma.loginLog.create({
          data: { email: currentUser.email, status: "FAILURE", ip_address: ip }
        });

        // brute force check
        const failedAttempts = await prisma.loginLog.count({
          where: {
            email: currentUser.email,
            status: "FAILURE",
            attempted_at: {
              gte: new Date(Date.now() - 10 * 60 * 1000) // last 10 minutes
            }
          }
        });

        if (failedAttempts > maxFailedAttempts) {
          maxFailedAttempts = failedAttempts;
        }

        // trigger logic to dept head and admin
        if (failedAttempts >= 5) {
          console.log(`🚨 SECURITY ALERT! Ang user [${currentUser.fname}] [${currentUser.lname}] of ${currentUser.department} ay may ${failedAttempts} na sunod-sunod na maling login sa loob ng 10 minuto!`);
          // Send email notification
          try {
            await sendFailedLoginAlert(currentUser, failedAttempts, ip);
          } catch (emailErr) {
            console.error('❌ Failed to send security alert email:', emailErr);
          }
        }
      }

      try {
        await logActivity({ req: request, userId: null, email, action: "LOGIN_FAILURE", details: JSON.stringify({ failedAttempts: maxFailedAttempts, ip }) });
      } catch (err) {
        console.error("Failed to log activity (login failure):", err);
      }

      return Response.json(
        { 
          success: false, 
          message: "Invalid Email or Password",
          failedAttempts: maxFailedAttempts,
          alertTriggered: maxFailedAttempts >= 5
        }, 
        { status: 401 }
      );
    }

    // tama lahat
    await prisma.loginLog.create({
      data: { email: authenticatedUser.email, status: "SUCCESS", ip_address: ip }
    });

    await prisma.user.update({
      where: { id: authenticatedUser.id }, 
      data: { last_login: new Date() }
    });

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    
    const token = await new SignJWT({ 
        id: authenticatedUser.id, 
        email: authenticatedUser.email,
        fname: authenticatedUser.fname,
        lname: authenticatedUser.lname,
        role: authenticatedUser.role,
        oic_start: authenticatedUser.oic_start,
        oic_end: authenticatedUser.oic_end
      })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("3d")
      .sign(secret);

    try {
      await logActivity({ req: request, userId: authenticatedUser.id, email: authenticatedUser.email, action: "LOGIN_SUCCESS", details: JSON.stringify({ ip }) });
    } catch (err) {
      console.error("Failed to log activity (login success):", err);
    }

    const response = Response.json(
      {
        success: true,
        message: "Login successful",
        user: {
          id: authenticatedUser.id,
          email: authenticatedUser.email,
          fname: authenticatedUser.fname,
          lname: authenticatedUser.lname,
          role: authenticatedUser.role
        },
      },
      { status: 200 }
    );

    // response.headers.append(
    //   "Set-Cookie",
    //   `session_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${60 * 60 * 24 * 3}` //3 days max-age
    // );
    response.headers.append(
      "Set-Cookie",
      `session_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 3}` //3 days max-age
    );

    return response;

  } catch (error) {
    console.error("Login Error sa loob ng JS Route:", error);
    return Response.json(
      { error: "An error occurred during login" },
      { status: 515 }
    );
  }
}