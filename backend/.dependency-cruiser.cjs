module.exports = {
  forbidden: [
    {
      name: "no-circular-dependencies",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "domain-does-not-depend-on-application",
      severity: "error",
      from: { path: "^src/domain/" },
      to: { path: "^src/application/" },
    },
    {
      name: "domain-does-not-depend-on-infrastructure",
      severity: "error",
      from: { path: "^src/domain/" },
      to: { path: "^src/infrastructure/" },
    },
    {
      name: "domain-does-not-depend-on-packages",
      severity: "error",
      from: { path: "^src/domain/" },
      to: { dependencyTypes: ["npm"] },
    },
    {
      name: "application-does-not-depend-on-infrastructure",
      severity: "error",
      from: { path: "^src/application/" },
      to: { path: "^src/infrastructure/" },
    },
    {
      name: "application-does-not-depend-on-framework-packages",
      severity: "error",
      from: { path: "^src/application/" },
      to: {
        dependencyTypes: ["npm"],
        pathNot: "^node_modules/typescript/",
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
  },
};
