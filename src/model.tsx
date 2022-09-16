export interface App {
    bundleId?: string;
    icon?: string;
    shell?: string;
    name: string;
}
export interface Config {
    path: string[];
    openby: string;
    terminal?: App;
    defaultApp?: App;
}

export interface Project {
    projectName: string;
    projectPath: string;
    app: App;
}
