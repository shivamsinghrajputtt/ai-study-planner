import "./globals.css";

export const metadata = {
  title: "AI Study Planner",
  description: "AI-powered personalized study planner",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
