type EmscriptenModule = {
  ccall: (
    ident: string,
    returnType: "string" | "number" | null,
    argTypes: Array<"string" | "number" | "array">,
    args: unknown[],
  ) => unknown;
};

type EmscriptenModuleFactory = (options?: {
  locateFile?: (path: string) => string;
}) => Promise<EmscriptenModule>;

declare const createConnect4SolverModule: EmscriptenModuleFactory;

export default createConnect4SolverModule;
