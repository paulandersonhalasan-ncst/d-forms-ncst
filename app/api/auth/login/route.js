// app/api/auth/login/route.js
import { prisma } from "../../../../prisma/prisma";
import { SignJWT } from "jose";

export async function POST(request) {
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";

  try {
    const req = await request.json();
    const { employee_id, password } = req;

    console.log("employee id for debug only:", employee_id);

    if (!employee_id || !password) {
      return Response.json(
        { success: false, message: "Missing Employee ID or Password" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { 
        employee_id: employee_id
      },
    });

    // case a: walang gantong employee_id sa database
    if (!user) {
      await prisma.loginLog.create({
        data: { employee_id: employee_id, status: "FAILURE", ip_address: ip }
      });

      return Response.json(
        { success: false, message: "Invalid Employee ID or Password" },
        { status: 401 }
      );
    }

    // case b: tama employee_id mali ang password
    if (user.password !== password) {
      await prisma.loginLog.create({
        data: { employee_id: user.employee_id, status: "FAILURE", ip_address: ip, email: user.email }
      });

      // brute force detection, bilangin ang mga failed attempts sa last 10 mins
      const failedAttempts = await prisma.loginLog.count({
        where: {
          employee_id: user.employee_id,
          status: "FAILURE",
          attempted_at: {
            gte: new Date(Date.now() - 10 * 60 * 1000) // last 10 minutes
          }
        }
      });

      //trigger alert to dept_head/superuser/coadmin
      if (failedAttempts >= 5) {
        console.log(`🚨 SECURITY ALERT! Ang user [${user.employee_id}] of ${user.department} ay may ${failedAttempts} na sunod-sunod na maling login sa loob ng 5 minuto!`);
        //later dapat gagawa ng notification for dept_head/superuser/coadmin to respective department accordingly
      }

      return Response.json(
        { 
          success: false, 
          message: "Invalid Employee ID or Password",
          failedAttempts: failedAttempts,
          alertTriggered: failedAttempts >= 5
        }, 
        { status: 401 }
      );
    }

    //case c: correct login
    await prisma.loginLog.create({
      data: { employee_id: user.employee_id, status: "SUCCESS", ip_address: ip }
    });

    await prisma.user.update({
      where: { employee_id: user.employee_id },
      data: { last_login: new Date() }
    });

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    
    const token = await new SignJWT({ 
        id: user.id, 
        employee_id: user.employee_id, 
        role: user.role // babasahin ng middleware
      })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("3d")
      .sign(secret);

    const response = Response.json(
      {
        success: true,
        message: "Login successful",
        user: {
          id: user.id,
          employee_id: user.employee_id,
          fname: user.fname,
          lname: user.lname,
          role: user.role
        },
      },
      { status: 200 }
    );

    response.headers.append(
      "Set-Cookie",
      `session_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${60 * 60 * 24 * 3}` //3 days max-age
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