module.exports = {
  forbidden: [
    {
      name: "no-circular-dependencies",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "shared-does-not-depend-on-features",
      severity: "error",
      from: { path: "^shared/" },
      to: { path: "^features/" },
    },
    {
      name: "features-do-not-depend-on-app-routes",
      severity: "error",
      from: { path: "^features/" },
      to: { path: "^app/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
  },
};
