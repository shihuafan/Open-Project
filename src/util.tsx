import { getApplications } from "@raycast/api"

const appConfigMap = new Map(Object.entries({
    'GoLand': { icon: 'goland.svg', shell: 'goland', language: 'golang' },
    'IntelliJ IDEA': { icon: 'idea.svg', shell: 'idea', language: 'java' },
    'PyCharm Professional': { icon: 'pycharm.svg', shell: 'pycharm', language: 'python' },
    'Visual Studio Code': { icon: 'vscode.png', shell: undefined, language: 'default' }
}))

const configFileWithLanguage = new Map(Object.entries({
    'go.mod': 'golang',
    'requirements.txt': 'python',
    'build.gradle': 'java',
    'pom.xml': 'java',
    'package.json': 'js'
}))

export default async function getApps() {
    const applications = await getApplications()
    const apps = new Map()
    applications.forEach(item => {
        const config = appConfigMap.get(item.name)
        if (config) {
            if (item.bundleId?.startsWith('com.jetbrains.toolbox')) {
                apps.set(config.language, { shell: config.shell, icon: config.icon })
            } else {
                console.log(item.bundleId)
                apps.set(config.language, { bundleId: item.bundleId, icon: config.icon })
            }
        }
    })

    return apps
}

export function getAppByLanguage(language: string | undefined, apps: Map<string, any>): any {
    return (language && apps.get(language)) ? apps.get(language) : apps.get('default')
}

export function getAllConfigFiles(): string[] {
    return Array.from(configFileWithLanguage.keys())
}

export function getLanguage(configFile: string): string | undefined {
    return configFileWithLanguage.get(configFile)
}