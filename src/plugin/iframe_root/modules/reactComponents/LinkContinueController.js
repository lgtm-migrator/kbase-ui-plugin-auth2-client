define([
    'preact',
    'htm',
    'kb_common_ts/Auth2Error',
    'kb_common_ts/Auth2',
    './ErrorAlert',
    './Loading',
    './LinkContinue',
    './TextSpan',
    './Alert',

    'bootstrap'
], (
    preact,
    htm,
    Auth2Error,
    {Auth2},
    ErrorAlert,
    Loading,
    LinkContinue,
    TextSpan,
    Alert
) => {

    const {h, Component} = preact;
    const html = htm.bind(h);

    class LinkContinueController extends Component {
        constructor(props) {
            super(props);
            this.state = {
                status: 'NONE'
            };
        }
        componentDidMount() {
            this.start();
        }

        async cancelLink(message) {
            const auth2Client = new Auth2({
                baseUrl: this.props.runtime.config('services.auth.url')
            });
            try {
                const id = this.state.choice.id;
                await auth2Client.linkCancel(id);
                if (message) {
                    this.props.runtime.notifyInfo(message);
                }
                this.returnToLinkingTab();
            } catch (ex) {
                console.error(ex);
                if (ex instanceof Auth2Error.AuthError) {
                    if (ex.code === '10010') {
                        // simply continue
                    } else {
                        throw ex;
                    }
                }
            }
        }

        returnToLinkingTab() {
            this.props.runtime.navigate({
                path: 'account',
                params: {
                    tab: 'links'
                }
            });
        }

        async linkIdentity() {
            const authToken = this.props.runtime.service('session').getAuthToken();
            const auth2 = new Auth2({
                baseUrl: this.props.runtime.config('services.auth.url')
            });

            try {
                await auth2.linkPick(authToken, this.state.choice.id);
                this.props.runtime.notifySuccess('Successfully linked identity', 3000);
                this.props.runtime.navigate({
                    path: 'account',
                    params: {
                        tab: 'links'
                    }
                });
            } catch (ex) {
                console.error(ex);
                this.props.runtime.notifyError(
                    `Error linking: ${ex.message}`
                );
            }
        }

        renderCancelAndReturnButton() {
            return html`
                <button 
                    type="button"
                    class="btn btn-default"
                    onClick=${this.cancelLink.bind(this)}>
                    cancel this session and return to the linking tab
                </button>
            `;
        }

        renderReturnButton() {
            return html`
                <button 
                    type="button"
                    class="btn btn-default"
                    onClick=${this.returnToLinkingTab.bind(this)}>
                    return to the linking tab
                </button>
            `;
        }

        async start() {
            try {
                this.setState({
                    status: 'PENDING'
                });

                this.props.runtime.send('ui', 'setTitle', 'Link a Provider');

                const authToken = this.props.runtime.service('session').getAuthToken();
                const auth2Client = new Auth2({
                    baseUrl: this.props.runtime.config('services.auth.url')
                });

                const root = await auth2Client.root();

                const serverTimeOffset = new Date().getTime() - root.servertime;

                const choice = await auth2Client.getLinkChoice(authToken);
                const {canlink, linkeduser, provider, provusername} = choice;

                const currentUsername = this.props.runtime.service('session').getUsername();

                if (!canlink) {
                    if (linkeduser === currentUsername) {
                        const message = html`
                            <div>
                                <p>
                                    Sorry, you have already linked your current KBase account
                                    <${TextSpan} bold=${true}>${currentUsername}</>
                                    to this 
                                    <${TextSpan} bold=${true}>${provider}</a>
                                    sign-in account
                                    <${TextSpan} bold=${true}>${provusername}</a>
                                </p>
                                <p>
                                    A sign-in account may only be linked once to any KBase account.
                                </p>
                                <p>
                                    You may ${this.renderCancelAndReturnButton()} \
                                    and start again, this time choosing a different sign-in account to link to.
                                </p>
                            </div>
                        `;
                        this.setState({
                            status: 'HALTED',
                            choice,
                            title: 'Sign-in account already linked',
                            message
                        });
                        return;
                    }
                    const message = html`
                            <div>
                                <p>
                                    Sorry, you have already linked this 
                                    <${TextSpan} bold=${true}>${provider}</a>
                                    sign-in account
                                    <${TextSpan} bold=${true}>${provusername}</a>
                                    to the KBase account 
                                    <${TextSpan} bold=${true}>${linkeduser}</a>
                                </p>
                                <p>
                                    A sign-in account may only be linked once to any KBase account.
                                </p>
                                <p>
                                    You may \
                                   ${this.renderCancelAndReturnButton()} \
                                    and start again, this time choosing a different sign-in account to link to.
                                </p>
                            </div>
                        `;
                    this.setState({
                        status: 'HALTED',
                        choice,
                        title: 'Sign-in account already linked',
                        message
                    });
                    return;
                }

                this.setState({
                    status: 'SUCCESS',
                    choice,
                    serverTimeOffset
                });
            } catch (ex) {
                console.error(ex);
                if (ex.code && ex.code === '10010') {
                    const message = html`
                        <p>A linking session was not found. This may be due to the expiration of the linking session, 
                        which is valid for 10 minutes. Or it may be because you have visited this path from your browser history.</p>
                        <p>You may ${this.renderReturnButton()} and try to link again.</p>
                    `;
                    this.setState({
                        status: 'ERROR',
                        title: 'Link Session Expired or Missing',
                        message
                    });
                } else {
                    this.setState({
                        status: 'ERROR',
                        message: ex.message
                    });
                }
            }
        }

        renderReturnTolinkingTab() {
            return html`
                <a href="
            `;
        }

        render() {
            switch (this.state.status) {
            case 'NONE':
            case 'PENDING':
                return html`
                    <${Loading} message="Loading..." />
                `;
            case 'SUCCESS': {
                const {
                    choice,
                    serverTimeOffset
                } = this.state;
                return html`
                    <${LinkContinue} 
                        runtime=${this.props.runtime}
                        serverTimeOffset=${serverTimeOffset}
                        choice=${choice}
                        cancelLink=${this.cancelLink.bind(this)}
                        linkIdentity=${this.linkIdentity.bind(this)}
                    />
                `;
            }
            case 'HALTED':
                return html`
                    <${Alert} type="warning" title=${this.state.title} message=${this.state.message} />
                `;
            case 'ERROR':
                return html`
                    <${ErrorAlert} title=${this.state.title} message=${this.state.message} />
                `;
            }
        }
    }

    return LinkContinueController;
});
