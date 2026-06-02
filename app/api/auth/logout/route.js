// app/api/auth/logout/route.js
export async function DELETE(request) {
  try {
    const response = Response.json({ success: true, message: "Logged out" }, { status: 200 });
    // Clear the cookie by setting it to empty and expiring it
    response.headers.append(
      "Set-Cookie",
      `session_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
    );
    return response;
  } catch (error) {
    console.error("Logout Error in route:", error);
    return Response.json({ success: false, error: "Logout failed" }, { status: 500 });
  }
}
