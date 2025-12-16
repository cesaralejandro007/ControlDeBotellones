import React from "react";

const Footer = () => {
  return (
    <footer className="footer">
      <span>
        © {new Date().getFullYear()} Control Botellones
      </span>

      <span className="footer-right">
        Hecho con 💧
      </span>
    </footer>
  );
};

export default Footer;
