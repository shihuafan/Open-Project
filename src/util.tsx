import { getApplications, Icon } from "@raycast/api"
import fs from 'fs'
import bPlistParser, { parseFileSync } from "bplist-parser";
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

const termianlApp = ['iTerm', 'Terminal', 'Warp']

export async function getApps() {
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

export function getAppByLanguage(filePath: string, apps: Map<string, any>, defult: any): any {
    const languages = fs.readdirSync(filePath).
        map(item => configFileWithLanguage.get(item)).
        map(item => item ? item : '').
        filter(item => item.length > 0)
    return (languages.length > 0 && apps.get(languages[0])) ? apps.get(languages[0]) : defult
}

export function getAllConfigFiles(): string[] {
    return Array.from(configFileWithLanguage.keys())
}

export function getLanguage(configFile: string): string | undefined {
    return configFileWithLanguage.get(configFile)
}

export function isTerminalApp(appName: string): boolean {
    return termianlApp.find(name => name == appName) != undefined
}

export async function getAllApp() {
    const applications = await getApplications()
    return applications.
        map(item => {
            const data = fs.readFileSync(`${item.path}/Contents/Info.plist`, 'utf8')
            let iconMatch: RegExpMatchArray | null

            if (data.startsWith('bplist')) {
                const parsedData = JSON.stringify(bPlistParser.parseFileSync(`${item.path}/Contents/Info.plist`))
                iconMatch = parsedData.match(/"CFBundleIconFile":"([\w\. ]+)",/)

            } else {
                iconMatch = data.match(/<key>CFBundleIconFile<\/key>\s*<string>([\w\. ]+)<\/string>/)
            }

            const iconPath = iconMatch ? iconMatch[1].endsWith('.icns') ?
              `${item.path}/Contents/Resources/${iconMatch[1]}` : `${item.path}/Contents/Resources/${iconMatch[1]}.icns` :
              'vscode.png'

            return {
                icon: iconPath,
                name: item.name,
                bundleId: item.bundleId,
                shell: undefined

            }
        })
}