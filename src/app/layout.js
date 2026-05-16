import "./globals.css";

export const metadata = {
  title: "LBFC Volunteer Portal",
  description: "Long Beach Food Coalition - Volunteer Scheduling",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" style={{ overflowX: "hidden" }}>
      <body className="antialiased min-h-screen" style={{ overflowX: "hidden", WebkitOverflowScrolling: "touch" }}>
        {children}
      </body>
    </html>
  );
}
