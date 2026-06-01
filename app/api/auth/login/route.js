// app/api/auth/login/route.js
import { prisma } from "../../../../prisma/prisma";

export async function POST(request) {
  try {
    // 1. Kunin ang payload mula sa Postman
    const req = await request.json();
    const { employee_id, password } = req;

    console.log("employee id for debug only:", employee_id);

    if (!employee_id || !password) {
      return Response.json(
        { success: false, message: "Missing Employee ID or Password" },
        { status: 400 }
      );
    }

    // 2. Query sa Postgres gamit si Prisma
    const user = await prisma.user.findUnique({
      where: { 
        employee_id: employee_id 
      },
    });

    if (!user) {
      return Response.json(
        { success: false, message: "Invalid Employee ID or Password" },
        { status: 401 }
      );
    }

    if (user.password !== password) {
      return Response.json(
        { success: false, message: "Invalid Employee ID or Password" },
        { status: 401 }
      );
    }

    return Response.json(
      {
        success: true,
        message: "Login successful",
        user: {
          id: user.id,
          employee_id: user.employee_id,
          fname: user.fname,
          lname: user.lname,
          role: user.role,
        },
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Login Error sa loob ng JS Route:", error);
    return Response.json(
      { error: "An error occurred during login" },
      { status: 515 }
    );
  }
}