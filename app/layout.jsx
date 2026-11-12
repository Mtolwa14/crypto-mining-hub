
import "./globals.css";

export const metadata = {
  title: "Crypto Mining Hub",
  description: "Mine Smart. Grow Digital."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
