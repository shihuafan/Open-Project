import { Action, ActionPanel, Form, Icon, List, LocalStorage, open, showToast, Toast } from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import child_process from 'child_process'
import { getAppByLanguage, getApps, getAllApp, isTerminalApp } from "./util";

type State = {
    config: Config;
    projects: Project[];
    applications: Map<string, App>;
};

interface App {
    bundleId: string | undefined;
    icon: string;
    shell?: string;
    name: string;
}
interface Config {
    path: string[];
    openby: string;
    terminal?: App;
    defaultApp?: App;
}

interface Project {
    projectName: string;
    projectPath: string;
    app: App;
}

export default function Command() {

    const openInBrowser = (path: string) => {
        try {
            const url = child_process.execSync(`awk '/url/{print $3}' ${path}/.git/config`, { encoding: 'utf-8' }).trim()
            const httpurl = url.startsWith('http') ? url : `https://${url.substring(4, url.length - 4).replace(':', '/')}`
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
        config: { path: [], openby: 'default' },
        projects: [],
        applications: new Map(),
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

        getApps().then(apps => {
            setState((pre) => ({ ...pre, applications: apps }))
        })
    }, [])

    useEffect(() => {
        if (state.config.path.length == 0 || Array.from(state.applications.keys()).length == 0) {
            return
        }
        const script = state.config.path.map((path) => `$(ls -dtF ${path})`).join('\n')
        // console.log(script)
        const projects = child_process.execSync(`echo "${script}"`, { encoding: 'utf-8' }).
            split('\n').filter(item => item.length > 0 && item.endsWith('/')).map(item => item.substring(0, item.length - 1)).map(item => {
                return {
                    projectName: item.substring(item.lastIndexOf('/') + 1),
                    projectPath: item,
                    app: state.config.openby != "default" ? getAppByLanguage(item, state.applications, state.config.defaultApp) :
                      state.config.defaultApp ? state.config.defaultApp : {
                              icon: Icon.Finder,
                              name: 'finder',
                              bundleId: 'com.apple.finder'
                    }
                }
            })
        if (projects.length > 0) {
            setState((pre) => ({ ...pre, projects: projects }))
        }
    }, [state.config, state.applications])

    return (
        <List>
            {
                state.projects.length > 0 ? state.projects.map((project) => (
                    <List.Item
                        key={project.projectPath}
                        title={project.projectName}
                        subtitle={project.projectPath}
                        icon={project.app.icon ? project.app.icon : Icon.Code}
                        actions={
                            <ActionPanel>
                                <Action icon={project.app.icon} title="Open" onAction={() => { openInIDE(project) }} />
                                <Action icon={Icon.Globe} title="OpenInBrowser" onAction={() => { openInBrowser(project.projectPath) }} />
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
                                    <EditConfig config={state.config} handleSubmit={handleSubmit} />
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
                                    <EditConfig config={state.config} handleSubmit={handleSubmit} />
                                </ActionPanel.Section>
                            </ActionPanel>
                        }
                    /> :
                    <List.Item
                        title='Add New Project'
                        actions={
                            <ActionPanel>
                                <ActionPanel.Section>
                                    <EditConfig config={state.config} handleSubmit={handleSubmit} />
                                </ActionPanel.Section>
                            </ActionPanel>
                        }
                    />
            }
        </List>
    );
}

function EditConfig(props: { config: Config, handleSubmit: (newPath: Config) => void }) {


    const [defaultApps, setdefaultApps] = useState<App[]>(
        (props.config.terminal ? [props.config.terminal] : []).concat(props.config.defaultApp ? [props.config.defaultApp] : [])
    );

    useEffect(() => {
        getAllApp().then(apps => {
            setdefaultApps(() => (apps))
        })
    }, [])

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
                            terminal: defaultApps.find(app => app.name === values.terminal),
                            defaultApp: defaultApps.find(app => app.name === values.default_app),
                        })
                    }} />
                </ActionPanel>
            }>
                <Form.TextArea id='project' title='Projects' defaultValue={props.config.path.join('\n')} />
                <Form.Dropdown id="default_app" title="Default Application" defaultValue={props.config.defaultApp?.name}
                    info="set default application to open your project">
                    {
                        defaultApps.map(app => {
                            return <Form.Dropdown.Item value={app.name} title={app.name} icon={app.icon} />
                        })
                    }
                </Form.Dropdown>
                <Form.Dropdown id="openby" title="Open by" defaultValue={props.config.openby}>
                    <Form.Dropdown.Item value="default" title="Always Default" icon={Icon.Code} />
                    <Form.Dropdown.Item value="jetbrain" title="JetBrain First" icon="jetbrain.png" />
                </Form.Dropdown>
                <Form.Dropdown id="terminal" title="Terminal" defaultValue={props.config.terminal?.name}>
                    {
                        defaultApps.filter(item => isTerminalApp(item.name)).map(app => {
                            return <Form.Dropdown.Item value={app.name} title={app.name} icon={app.icon} />
                        })
                    }
                </Form.Dropdown>
            </Form>
        } />
}
