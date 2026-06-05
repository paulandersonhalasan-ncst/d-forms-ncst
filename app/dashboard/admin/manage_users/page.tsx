import Link from "next/link";
import UsersTable from "./UsersTable";

export default function ManageUsersPage() {
	return (
		<main style={{padding:20}}>
			<h1>Manage Users</h1>
			<UsersTable />
		</main>
	);
}