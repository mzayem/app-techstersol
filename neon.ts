import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  branch: (branch) => ({
    protected: branch.name === "production",
  }),
});
