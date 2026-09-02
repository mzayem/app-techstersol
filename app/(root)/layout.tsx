// import Header from "@/components/layout/Header";
// import Footer from "@/components/layout/Footer";

export default async function setupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* <Header /> */}
      {children}
      {/* <Footer /> */}
    </>
  );
}
