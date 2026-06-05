// app/api/department/edit/route.js
import { prisma } from "../../../../prisma/prisma";

export const dynamic = "force-dynamic";

//id + oldcode + newcode

export async function POST(request) {
	try {
		const req = await request.json().catch(() => null);
		const items = Array.isArray(req) ? req : req ? [req] : [];

        console.log(req);

		if (items.length === 0) {
			return Response.json({ success: false, message: "Walang data na ipinadala para i-edit." }, { status: 400 });
		}

		const updated = [];

		for (const it of items) {
			if (!it || (!it.id && !it.code) || !it.newCode) {
				return Response.json({ success: false, message: "Kulang ang identifier (id or code) o bagong code (newCode)." }, { status: 400 });
			}

			// find existing department by id or code
			let existing = null;
			if (it.id) existing = await prisma.department.findUnique({ where: { id: it.id } });
			if (!existing && it.code) existing = await prisma.department.findFirst({ where: { code: String(it.code).toUpperCase().trim() } });

			if (!existing) {
				return Response.json({ success: false, message: `Department not found for identifier: ${it.code || it.id}` }, { status: 404 });
			}

			const newCode = String(it.newCode).toUpperCase().trim();
			if (!newCode) {
				return Response.json({ success: false, message: `Invalid newCode provided.` }, { status: 400 });
			}

			// If same code, skip
			if (newCode === existing.code) {
				updated.push({ id: existing.id, code: existing.code, message: "No change" });
				continue;
			}

			// ensure uniqueness
			const conflict = await prisma.department.findFirst({ where: { code: newCode } });
			if (conflict) {
				return Response.json({ success: false, message: `Department code [${newCode}] already in use.` }, { status: 409 });
			}

			// Update department code and the users referencing it in a transaction
			await prisma.$transaction([
				prisma.department.update({
					where: { id: existing.id },
					data: { code: newCode },
				}),
				prisma.user.updateMany({
					where: { departmentCode: existing.code },
					data: { departmentCode: newCode },
				}),
			]);

			updated.push({ id: existing.id, code: newCode });
		}

		return Response.json({ success: true, message: `Updated ${updated.length} department(s).`, departments: updated });
	} catch (error) {
		console.error("Error sa Edit Department Route:", error);
		return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
	}
}

