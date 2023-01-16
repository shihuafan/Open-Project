import { Action, ActionPanel, Form, Icon, List, LocalStorage, open, showToast, Toast } from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import child_process from 'child_process'
import { getAppByLanguage, getAllApp, isTerminalApp, getJetBrainApps, loadVscodeConfig } from "./util";
import { App, Config, Project, VscodeRemoteConfig } from "./model";
import gitUrlParse from "git-url-parse";
type State = {
    config: Config;
    projects: Project[];
    applications: App[];
    jetbrainApps: Map<string, App>;
};

export default function Command() {

    const openInBrowser = (path: string) => {
        try {
            const url = child_process.execSync(`awk '/url/{print $3}' ${path}/.git/config`, { encoding: 'utf-8' }).trim()
            const httpurl = gitUrlParse(url).toString("https")
            open(httpurl)
        } catch (e) {
            console.log(e)
            showToast({
                style: Toast.Style.Failure,
                title: "Can not open in Browser"
            });
        }
    }

    const openInIDE = (project: Project) => {
        if (project.app.bundleId) {
            open(project.projectPath, project.app.bundleId)
        } else {
            try {
                child_process.exec(`${project.app.shell} ${project.projectPath}`)
            } catch (e) {
                showToast({
                    style: Toast.Style.Failure,
                    title: `Can not open in ${project.app.shell}`
                });
            }
        }
    }

    const handleSubmit = useCallback(
        // save to storage and update
        (config: Config) => {
            LocalStorage.setItem("config", JSON.stringify(config)).then(() => {
                showToast({
                    style: Toast.Style.Success,
                    title: "save successed",
                });
                setState((previous) => ({ ...previous, config: config }));
            }).catch(reason => {
                showToast({
                    style: Toast.Style.Failure,
                    title: "save fail, error: " + reason,
                });
            })
        }, []
    );

    const [state, setState] = useState<State>({
        config: { path: [], openby: 'default', enableVscodeRemote: false },
        projects: [],
        applications: [],
        jetbrainApps: new Map()
    });

    useEffect(() => {
        LocalStorage.getItem<string>("config").then(configStr => {
            if (configStr) {
                console.log(configStr)
                const config: Config = JSON.parse(configStr);
                setState((previous) => ({ ...previous, config: config }));
            }
        }).catch(reason => {
            showToast({
                style: Toast.Style.Failure,
                title: "load fail, error: " + reason,
            });
        })

        getAllApp().then(apps => {
            setState((pre) => ({ ...pre, applications: apps }))
        })

        getJetBrainApps().then(apps => {
            setState((pre) => ({ ...pre, jetbrainApps: apps }))
        })

    }, [])

    useEffect(() => {
        if (state.config.path.length == 0 || Array.from(state.applications.keys()).length == 0) {
            return
        }
        const script = `$(ls -dtF ${state.config.path.join(' ')})`
        // console.log(script)
        const projects = child_process.execSync(`echo "${script}"`, { encoding: 'utf-8' }).
            split('\n').filter(item => item.length > 0 && item.endsWith('/')).map(item => item.substring(0, item.length - 1)).map(item => {
                const defaultApp = state.config.defaultApp ? state.config.defaultApp : {
                    icon: Icon.Finder,
                    name: 'finder',
                    bundleId: 'com.apple.finder'
                }
                return {
                    projectName: item.substring(item.lastIndexOf('/') + 1),
                    projectPath: item,
                    app: state.config.openby != "default" ? getAppByLanguage(item, state.jetbrainApps, defaultApp) : defaultApp
                }
            })
        // projects.forEach(item => console.log(item))
        if (projects.length > 0) {
            setState((pre) => ({ ...pre, projects: projects }))
        }
    }, [state.config, state.applications])

    const [searchText, setSearchText] = useState('');

    return (
        <List filtering={false} onSearchTextChange={setSearchText}>
            <List.Section title="local project">
                {
                    state.projects.length > 0 ? state.projects.filter(project => project.projectName.includes(searchText)).map((project) => (
                        <List.Item
                            key={project.projectPath}
                            title={project.projectName}
                            subtitle={project.projectPath}
                            icon={project.app.icon ? project.app.icon : Icon.Code}
                            actions={
                                <ActionPanel>
                                    <Action icon={project.app.icon} title="Open" onAction={() => { openInIDE(project) }} />
                                    <Action icon={Icon.Globe} title="Open In Browser" onAction={() => { openInBrowser(project.projectPath) }} />
                                    <Action.Open icon={Icon.Terminal} title="Open In Terminal" shortcut={{ modifiers: ["cmd"], key: "t" }}
                                        application={state.config.terminal?.bundleId ? state.config.terminal.bundleId : 'com.apple.Terminal'}
                                        target={project.projectPath} />
                                    {
                                        state.config.defaultApp ? <Action.Open icon={state.config.defaultApp.icon} shortcut={{ modifiers: ["opt"], key: "enter" }}
                                            title={`Open In ${state.config.defaultApp.name}`}
                                            application={state.config.defaultApp.bundleId} target={project.projectPath} /> :
                                            <Action.Open icon={Icon.Finder} title="Open In Finder" shortcut={{ modifiers: ["opt"], key: "enter" }}
                                                application='com.apple.finder' target={project.projectPath} />
                                    }
                                    <ActionPanel.Section>
                                        <EditConfig config={state.config} apps={state.applications} handleSubmit={handleSubmit} />
                                    </ActionPanel.Section>
                                </ActionPanel>
                            }
                        />
                    )) : state.config.path.length > 0 ?
                        <List.Item
                            title='Loading ......'
                            icon={Icon.Circle}
                            actions={
                                <ActionPanel>
                                    <ActionPanel.Section>
                                        <EditConfig config={state.config} apps={state.applications} handleSubmit={handleSubmit} />
                                    </ActionPanel.Section>
                                </ActionPanel>
                            }
                        /> :
                        <List.Item
                            title='Add New Project'
                            actions={
                                <ActionPanel>
                                    <ActionPanel.Section>
                                        <EditConfig config={state.config} apps={state.applications} handleSubmit={handleSubmit} />
                                    </ActionPanel.Section>
                                </ActionPanel>
                            }
                        />
                }
            </List.Section>
            <List.Section title="vscode remote">
                {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    loadVscodeConfig().filter(item => state.config.enableVscodeRemote && displatVscodeRemote(item, searchText)).map(item => (
                        <List.Item
                            key={`${item.host}:${item.folder}`}
                            title={`${item.host}:${item.folder.substring(1 + item.folder.lastIndexOf('/'))}`}
                            subtitle={item.folder}
                            icon='remote.png'
                            actions={
                                <ActionPanel>
                                    <Action icon={Icon.Code} title="Open" onAction={() => {
                                        child_process.exec(`code --folder-uri=vscode-remote://ssh-remote+${item.host}${item.folder}`)
                                    }} />
                                    <ActionPanel.Section>
                                        <EditConfig config={state.config} apps={state.applications} handleSubmit={handleSubmit} />
                                    </ActionPanel.Section>
                                </ActionPanel>
                            }
                        />
                    ))
                }
            </List.Section>

        </List>
    );
}

function displatVscodeRemote(item: VscodeRemoteConfig, searchText: string): boolean {
    const searchItem = searchText.split(' ')
    console.log(searchItem)
    return searchItem.length <= 0 ||
        (searchItem.length == 1 && item.folder.includes(searchItem[0])) ||
        (searchItem.length == 1 && item.host.includes(searchItem[0])) ||
        (searchItem.length == 2 && item.host.includes(searchItem[0]) && item.folder.includes(searchItem[1])) ||
        (searchItem.length == 2 && item.host.includes(searchItem[1]) && item.folder.includes(searchItem[0]))
}

function EditConfig(props: { config: Config, apps: App[], handleSubmit: (newPath: Config) => void }) {

    return <Action.Push
        icon={Icon.Pencil}
        title="Edit Config"
        target={
            <Form actions={
                <ActionPanel>
                    <Action.SubmitForm title="Submit" onSubmit={(values) => {
                        props.handleSubmit({
                            path: values.project.split('\n'),
                            openby: values.openby,
                            terminal: props.apps.find(app => app.name === values.terminal),
                            defaultApp: props.apps.find(app => app.name === values.default_app),
                            enableVscodeRemote: values.enable_vscode_remote
                        })
                    }} />
                </ActionPanel>
            }>
                <Form.TextArea id='project' title='Projects' defaultValue={props.config.path.join('\n')} />
                <Form.Dropdown id="default_app" title="Default Application" defaultValue={props.config.defaultApp?.name}
                    info="set default application to open your project">
                    {
                        props.apps.map(app => {
                            return <Form.Dropdown.Item value={app.name} title={app.name} icon={app.icon} key={app.name} />
                        })
                    }
                </Form.Dropdown>
                <Form.Dropdown id="openby" title="Open by" defaultValue={props.config.openby}>
                    <Form.Dropdown.Item value="default" title="Always Default" icon={Icon.Code} />
                    <Form.Dropdown.Item value="jetbrain" title="JetBrain First" icon="jetbrain.png" />
                </Form.Dropdown>
                <Form.Dropdown id="terminal" title="Terminal" defaultValue={props.config.terminal?.name}>
                    {
                        props.apps.filter(item => isTerminalApp(item.name)).map(app => {
                            return <Form.Dropdown.Item value={app.name} title={app.name} icon={app.icon} key={app.name} />
                        })
                    }
                </Form.Dropdown>
                <Form.Checkbox id="enable_vscode_remote" title="Vscode Remote" label="load remote project by vscode?" defaultValue={props.config.enableVscodeRemote} onChange={(enable) => {
                    if (enable) {
                        child_process.exec('code -v', (e) => {
                            if (e) {
                                showToast({
                                    style: Toast.Style.Failure,
                                    title: "can not execute `code` in terminal"
                                });
                            }
                        })
                    }
                }} />
            </Form>
        } />
}
