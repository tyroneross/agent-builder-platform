import "./globals.css";

export const metadata = {
  title: "Investments — review",
  description: "Local investment review: materials, claim research and validation, and a review store.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
