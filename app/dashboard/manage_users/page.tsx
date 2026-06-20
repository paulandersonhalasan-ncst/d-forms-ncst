import Link from "next/link";
import UsersTable from "./UsersTable";

export default function ManageUsersPage() {
	return (
		<main style={{padding:20}}>
			<UsersTable />
		</main>
	);
}