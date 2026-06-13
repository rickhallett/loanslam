export default {
  test: {
    include: ["packages/**/*.test.ts"],
    globals: false,
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
};
