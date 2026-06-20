export default {
  test: {
    include: ["packages/**/*.test.ts", "scripts/**/*.test.ts"],
    globals: false,
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
};
