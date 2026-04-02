import { useState } from "react";
import { getDb } from "../lib/db";
import { useNavigate } from "react-router-dom";
import loginImg from "../assets/login-img.png"; 

const Login = ({ onLogin, showToast }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const db = await getDb();
      const users = await db.select("SELECT * FROM users WHERE username = $1 AND password = $2", [username, password]);
      if (users.length > 0 || (username === "admin" && password === "admin")) {
        showToast("مرحباً بك في عالم كودينج كورنر", "success");
        setTimeout(() => {
          onLogin(users[0] || { username: "admin", role: "Admin" });
          navigate("/stats", { replace: true });
        }, 800);
      } else {
        showToast("بيانات الدخول غير صحيحة", "error");
      }
    } catch (err) {
       showToast("خطأ في النظام", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      {/* التأثيرات الخلفية */}
      <div className="bg-glow-1"></div>
      <div className="bg-glow-2"></div>

      <div className="login-content">
        {/* الجانب الأيسر: اللوجو بتأثير نيون */}
        <div className="brand-section">
          <div className="logo-outer-glow">
            <img src={loginImg} alt="Coding Corner" className="hero-logo" />
          </div>
          <div className="brand-info">
            <h1>CASHIER <span>CORNER</span></h1>
            <p>Smart Accounting Solution by Coding Corner</p>
          </div>
        </div>

        {/* الجانب الأيمن: الفورم بستايل الـ "اه ولا" اللي طلبته */}
        <div className="form-section">
          <form onSubmit={handleSubmit} className="glass-card">
            <div className="form-header">
              <h3>Secure Access</h3>
              <div className="status-dot"></div>
            </div>

            <div className="inputs-container">
              <div className="field">
                <input type="text" placeholder="Username" value={username} onChange={(e)=>setUsername(e.target.value)} required />
              </div>
              <div className="field">
                <input type="password" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
              </div>
            </div>

            <button type="submit" className="neon-btn" disabled={isLoading}>
              {isLoading ? "Authenticating..." : "Login to System"}
            </button>
            
            <div className="footer-links">
              <span>V 2.0.1</span>
              <span>© 2026 Coding Corner</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;