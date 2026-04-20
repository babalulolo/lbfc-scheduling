import "./globals.css";

export const metadata = {
  title: "LBFC Volunteer Portal",
  description: "Long Beach Food Coalition - Volunteer Scheduling",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
