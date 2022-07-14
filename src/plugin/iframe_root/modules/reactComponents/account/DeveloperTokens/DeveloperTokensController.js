define([
    'preact',
    'htm',
    'kb_common_ts/Auth2',
    'lib/utils',
    'reactComponents/ErrorAlert',
    'reactComponents/Loading',
    './DeveloperTokens',

    'bootstrap'
], (
    preact,
    htm,
    {Auth2},
    Utils,
    ErrorAlert,
    Loading,
    DeveloperTokens
) => {

    const {h, Component} = preact;
    const html = htm.bind(h);

    class DeveloperTokensController extends Component {
        constructor(props) {
            super(props);
            // Okay, weirdo.
            this.utils = Utils.make({
                runtime: this.props.runtime
            });
            this.state = {
                status: 'NONE'
            };
        }

        componentDidMount() {
            this.loadData();
        }

        async revokeToken(tokenID) {
            const auth2 = new Auth2({
                baseUrl: this.props.runtime.config('services.auth.url')
            });
            const authToken = this.props.runtime.service('session').getAuthToken();
            try {
                await auth2.revokeToken(authToken, tokenID);
                await this.fetchDeveloperTokens();
            } catch (ex) {
                console.error(ex);
                // TODO: what now? probably send an alert
            }
        }

        async revokeAllTokens() {
            const auth2 = new Auth2({
                baseUrl: this.props.runtime.config('services.auth.url')
            });
            const authToken = this.props.runtime.service('session').getAuthToken();
            try {
                const {tokens: currentTokens} = await auth2.getTokens(authToken);

                // All others
                await Promise.all(currentTokens
                    .filter(({type}) => {
                        return type=== 'Developer';
                    })
                    .map(({id}) => {
                        return auth2.revokeToken(authToken, id);
                    }));

                await this.fetchDeveloperTokens();
            } catch (ex) {
                console.error(ex);
                // TODO: what now? probably send an alert
            }
        }

        async createDeveloperToken(name) {
            const auth2 = new Auth2({
                baseUrl: this.props.runtime.config('services.auth.url')
            });
            const authToken = this.props.runtime.service('session').getAuthToken();
            try {
                const newToken = await auth2.createToken(authToken, {
                    name,
                    type: 'developer'
                });

                this.setState({
                    value: {
                        ...this.state.value,
                        newToken,
                        tokens: this.state.value.tokens.concat([newToken])
                    }
                });
            } catch (ex) {
                console.error(ex);
                // what to do - notification?
            }
        }

        clearNewToken() {
            this.setState({
                value: {
                    ...this.state.value,
                    newToken: null
                }
            });
        }

        async fetchDeveloperTokens() {
            const auth2 = new Auth2({
                baseUrl: this.props.runtime.config('services.auth.url')
            });
            const authToken = this.props.runtime.service('session').getAuthToken();
            const {tokens} = await auth2.getTokens(authToken);

            const serverTimeBias = await this.utils.getTimeBias();
            this.setState({
                status: 'SUCCESS',
                value: {
                    tokens: tokens.filter((token) => {
                        return token.type === 'Developer';
                    }),
                    serverTimeBias
                }
            });
        }

        async loadData() {
            this.setState({
                status: 'PENDING'
            });
            try {
                await this.fetchDeveloperTokens();
            } catch (ex) {
                this.setState({
                    status: 'ERROR',
                    error: {
                        message: ex.message
                    }
                });
            }
        }

        render() {
            switch (this.state.status) {
            case 'NONE':
            case 'PENDING':
                return html`
                    <${Loading} message="Loading..." />
                `;
            case 'SUCCESS':
                return html`
                    <${DeveloperTokens} 
                        runtime=${this.props.runtime} 
                        tokens=${this.state.value.tokens} 
                        serverTimeBias=${this.state.value.serverTimeBias}
                        newToken=${this.state.value.newToken}
                        createToken=${this.createDeveloperToken.bind(this)}
                        revokeToken=${this.revokeToken.bind(this)}
                        revokeAllTokens=${this.revokeAllTokens.bind(this)}
                        clearNewToken=${this.clearNewToken.bind(this)}
                    />
                `;
            case 'ERROR':
                return html`
                    <${ErrorAlert} message=${this.state.error.message} />
                `;
            }
        }
    }

    return DeveloperTokensController;
});