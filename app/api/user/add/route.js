// app/api/user/add/route.js
import { prisma } from "../../../../prisma/prisma";

export async function POST(request) {
  try {
    const req = await request.json();
    const usersArray = Array.isArray(req) ? req : [req];

    if (usersArray.length === 0) {
      return Response.json({ success: false, message: "Walang data na ipinadala." }, { status: 400 });
    }

    const createdUsers = [];

    // Loop sa bawat user na gustong irehistro
    for (const userData of usersArray) {
      const { employee_id, email, password, fname, lname, role, branch, departmentCode } = userData;

      // 1. VALIDATION: Tsek kung may kulang na basic fields
      if (!employee_id || !email || !password || !fname || !lname || !departmentCode) {
        return Response.json(
          { success: false, message: `May kulang na fields para kay Email: ${email || "Unknown"}` },
          { status: 400 }
        );
      }

      // 2. DEPARTMENT CHECK: Hanapin ang UUID ng Department gamit ang Code (e.g., "ITO")
      const targetDept = await prisma.department.findFirst({
        where: { code: departmentCode.toUpperCase().trim() }
      });

      if (!targetDept) {
        return Response.json(
          { success: false, message: `Hindi nahanap ang Department Code na: [${departmentCode}] sa database. Populate mo muna!` },
          { status: 404 }
        );
      }

      console.log(userData.email);

      // 3. DUPLICATE CHECK: Tsek kung may kaparehong email na rehistrado na
      const existingUser = await prisma.user.findFirst({
        where: { employee_id: employee_id.trim() }
      });

      if (existingUser) {
        return Response.json(
          { success: false, message: `Ang email na [${email}] ay rehistrado na!` },
          { status: 409 }
        );
      }

      // 4. INSERTION: Isaksak na sa Postgres!
      // Pro-tip: Sa production, dapat naka-hash ang password gamit ang bcrypt: await bcrypt.hash(password, 10)
      const newUser = await prisma.user.create({
        data: {
          employee_id: employee_id.trim(),
          email: email.toLowerCase().trim(),
          password: password, // Plain text muna gaya ng setup mo ngayon
          fname: fname.trim(),
          lname: lname.trim(),
          role: role, // Awtomatikong babasahin ang Enum (Staff, CoAdmin, DepartmentHead, SuperUser)
          branch: branch || "MAIN",
          departmentCode: targetDept.code,
        }
      });

      createdUsers.push({
        id: newUser.id,
        employee_id: newUser.employee_id,
        email: newUser.email,
        role: newUser.role,
        department: departmentCode
      });
    }

    return Response.json(
      {
        success: true,
        message: `Matagumpay na nairerehistro ang ${createdUsers.length} na (mga) user!`,
        users: createdUsers
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Error sa Add User Route:", error);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}