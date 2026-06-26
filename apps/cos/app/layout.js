import "./globals.css";

export const metadata = {
  title: "Chief of Staff",
  description: "Local Chief-of-Staff scheduling and briefing, with a model cascade across local and cloud lanes.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
