const CONFIG = {
  API_URL: "",

  ROUTES: {
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",

    QUESTIONS: "/api/questions",

    BOOKMARKS: "/api/questions/me/bookmarks",
  },

  FIELDS: {
    LOGIN: ["email", "password"],

    REGISTER: ["email", "password", "name"],

    QUESTION: ["question", "date", "answer", "keywords"],

    ATTEMPT: ["userAnswer"],
  },

  QUESTIONS_PER_PAGE: 5,

  STORAGE_KEY: "jwt_token",
};