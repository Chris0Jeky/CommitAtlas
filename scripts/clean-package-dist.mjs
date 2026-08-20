import {
  removePackageDist,
  resolvePackageContext,
  withPackageBuildLock,
} from "./package-build-utils.mjs";

const context = resolvePackageContext();
withPackageBuildLock(context.repositoryRoot, () => removePackageDist(context));
