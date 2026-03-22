import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "1rem" }}>
      <h1>Authentication failed</h1>
      <p>Something went wrong during sign-in. Please try again.</p>
      <Link href="/">Back to home</Link>
    </div>
  );
}
