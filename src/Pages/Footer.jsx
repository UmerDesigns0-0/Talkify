function Footer() {
  return (
    <div className="bg-emerald-600 p-8 md:p-4 text-sm md:text-xs bottom-0 text-white text-center">
      © {new Date().getFullYear()} Talkify. All rights reserved.
    </div>
  );
}

export default Footer;