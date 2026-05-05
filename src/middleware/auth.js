
const jwt = require("jsonwebtoken")
const SECRET = process.env.JWT_SECRET

function authenticate(request, response, next){
  const authHeader = request.headers.authorization

  if(!authHeader || !authHeader.startsWith("Bearer ")){
    return response.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET);
    request.user = decoded;
    next();
  } catch (err) {
    response.status(403).json({ error: "Invalid or expired token" });
  }

}

module.exports = authenticate