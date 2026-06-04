// app/api/department/add/route.js (I-adjust mo ang path ng folder kung iba ang pangalan)
import { prisma } from "../../../../prisma/prisma";

export async function POST(request) {
  try {
    const req = await request.json();

    // 🆕 HAKBANG 1: Gawing array ang input para kahit isa o marami, parehong gagana
    const departmentsArray = Array.isArray(req) ? req : [req];

    if (departmentsArray.length === 0) {
      return Response.json(
        { success: false, message: "Walang data na ipinadala sa request body." },
        { status: 400 }
      );
    }

    // 🆕 HAKBANG 2: Linisin at i-format ang mga input (Gawing uppercase ang code)
    const formattedDepartments = departmentsArray.map((dept) => ({
      code: dept.code?.toUpperCase().trim()
    }));

    // 🆕 HAKBANG 3: Masusing Validation para sa maramihang data
    for (const dept of formattedDepartments) {
      if (!dept.code) {
        return Response.json(
          { success: false, message: "May kulang na 'code' sa isa sa mga departament" },
          { status: 400 }
        );
      }
    }

    // 🆕 HAKBANG 4: I-tsek kung may matatamaan na umiiral na sa database
    const codesToCheck = formattedDepartments.map(d => d.code);
    const existingDepts = await prisma.department.findMany({
      where: { code: { in: codesToCheck } }
    });

    if (existingDepts.length > 0) {
      const duplicateCodes = existingDepts.map(d => d.code).join(", ");
      return Response.json(
        { 
          success: false, 
          message: `Hindi pwedeng ituloy. Ang mga sumusunod na code ay rehistrado na sa database: [${duplicateCodes}]` 
        },
        { status: 409 }
      );
    }

    // 🆕 HAKBANG 5: BULK INSERTION gamit ang createMany!
    // Mas mabilis ito dahil isang bagsakan lang ang transaction sa Postgres.
    const result = await prisma.department.createMany({
      data: formattedDepartments,
      skipDuplicates: true, //Para siguradong walang error kung may sumabot na duplicate
    });

    return Response.json(
      {
        success: true,
        message: `${result.count} departments added`,
        count: result.count
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Error sa Bulk Add Department Route:", error);
    return Response.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}