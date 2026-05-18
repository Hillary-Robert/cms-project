const { defineConfig } = require("vitest/config");
require("dotenv").config({ path: ".env.test" });

module.exports = defineConfig({
  test: { 
    environment: "node", 
    globals: true,
    
    // 1. Tell Vitest to run files one after another, not simultaneously
    sequence: {
      concurrent: false,
    },
    
    // 2. Lock execution down to exactly 1 single worker process
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,

    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.js"],
      exclude: ["src/generated/**", "src/index.js"],
    }  
  }
});
