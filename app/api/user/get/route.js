// app/api/user/route.js
import { prisma } from "../../../../prisma/prisma";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get("email");

    console.log(searchParams)

    if (userEmail) {
      const user = await prisma.user.findUnique({
        where: {email : userEmail},
      });

      console.log(user);

      if (!user) {
        return Response.json(
          { success: false, message: "User not found." },
          { status: 404 }
        );
      }

      return Response.json({ success: true, data: user });
    }

    //if no params, return all users
    const allUsers = await prisma.user.findMany();

    return Response.json({
      success: true,
      count: allUsers.length,
      data: allUsers
    });

  } catch (error) {
    console.error("Error sa Hybrid Get User Route:", error);
    return Response.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}