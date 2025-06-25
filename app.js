// Configuração do Supabase - SUBSTITUA PELAS SUAS CREDENCIAIS DO PROJETO SUPABASE
        const SUPABASE_URL = 'https://jljiwewobojdkkbrhlow.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsaml3ZXdvYm9qZGtrYnJobG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxODYxNTQsImV4cCI6MjA2NTc2MjE1NH0.ct8D0jzWSvbIB_oPMVhSn2zW9gTKmPYzc1fIf_IrcAo';
        const supabase = window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
        // Estado Global da Aplicação
        const state = {
            user: null, // Objeto de usuário Supabase
            profile: null, // Perfil do usuário (admin/operacional)
            items: [], // Lista de itens em estoque
            transactions: [], // Histórico de transações
            dashboardStats: {}, // Estatísticas do dashboard
            topConsumedItems: [], // Itens mais consumidos
            stockStatusData: {}, // Dados para o gráfico de status do estoque
            currentTab: 'dashboard-tab', // Aba atualmente ativa
            loading: true, // Estado de carregamento
            // Filtros da página de estoque
            inventorySearchTerm: '',
            inventoryFilterStatus: 'all',
            inventoryFilterSupplier: 'all'
        };

        // Funções de Utilidade
        /**
         * Exibe uma mensagem toast.
         * @param {string} message - A mensagem a ser exibida.
         * @param {'success'|'error'|'info'} [type='success'] - O tipo da mensagem (cor).
         */
        function showToast(message, type = 'success') {
            const toastContainer = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `p-3 rounded-lg shadow-lg text-white ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`;
            toast.textContent = message;
            toastContainer.appendChild(toast);
            setTimeout(() => {
                toast.remove();
            }, 3000); // Remove o toast após 3 segundos
        }

        /**
         * Mostra o spinner de carregamento.
         */
        function showLoading() {
            document.getElementById('loading-spinner').classList.remove('hidden');
            state.loading = true;
        }

        /**
         * Oculta o spinner de carregamento.
         */
        function hideLoading() {
            document.getElementById('loading-spinner').classList.add('hidden');
            state.loading = false;
        }

        /**
         * Renderiza a página de autenticação e oculta a aplicação principal.
         */
        function renderAuthPage() {
            document.getElementById('auth-page').classList.remove('hidden');
            document.getElementById('main-app').classList.add('hidden');
        }

        /**
         * Renderiza a aplicação principal e oculta a página de autenticação.
         */
        function renderMainApp() {
            document.getElementById('auth-page').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            renderHeader(); // Renderiza o cabeçalho com informações do usuário
            renderNavigationTabs(); // Renderiza as abas de navegação
            renderCurrentTab(); // Renderiza o conteúdo da aba atual
        }

        /**
         * Renderiza as informações do usuário no cabeçalho.
         */
        function renderHeader() {
            const userDisplayName = document.getElementById('user-display-name');
            userDisplayName.textContent = state.profile ? state.profile.name : 'Usuário';
        }

        /**
         * Realiza o logout do usuário.
         */
        async function logout() {
            showLoading();
            const { error } = await supabase.auth.signOut();
            hideLoading();
            if (error) {
                console.error('Erro ao fazer logout:', error.message);
                showToast('Erro ao fazer logout.', 'error');
            } else {
                state.user = null;
                state.profile = null;
                showToast('Logout realizado com sucesso!', 'success');
                renderAuthPage(); // Redireciona para a página de login
            }
        }

        // Listener de mudança de estado de autenticação do Supabase
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                state.user = session.user;
                await fetchUserProfile(); // Busca o perfil do usuário logado
                if (state.profile) {
                    renderMainApp();
                    await fetchAllData(); // Busca todos os dados iniciais após o login
                } else {
                    // Caso o perfil não seja encontrado imediatamente (ex: após um novo cadastro sem perfil)
                    showToast('Perfil de usuário não encontrado. Tente novamente.', 'error');
                    await supabase.auth.signOut(); // Força o logout
                }
            } else if (event === 'SIGNED_OUT') {
                state.user = null;
                state.profile = null;
                renderAuthPage(); // Redireciona para a página de login
            }
        });

        /**
         * Verifica o estado inicial de autenticação ao carregar a página.
         */
        async function initialAuthCheck() {
            console.log('Iniciando verificação de autenticação');
            showLoading();
            console.log('Antes do getSession');
            const { data: { session }, error } = await supabase.auth.getSession();
            console.log('Depois do getSession', session, error);
            hideLoading();
            if (error) {
                console.error('Erro ao obter sessão:', error.message);
                renderAuthPage();
            } else if (session) {
                state.user = session.user;
                await fetchUserProfile();
                if (state.profile) {
                    renderMainApp();
                    await fetchAllData();
                } else {
                    showToast('Perfil de usuário não encontrado. Faça login novamente.', 'error');
                    await supabase.auth.signOut();
                    renderAuthPage();
                }
            } else {
                renderAuthPage(); // Se não houver sessão, mostra a página de login
            }
            console.log('Finalizou verificação de autenticação');
        }

        /**
         * Busca o perfil do usuário logado no banco de dados.
         */
        async function fetchUserProfile() {
            if (!state.user) return;
            showLoading();
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', state.user.id)
                .single();
            hideLoading();
            if (error && error.code !== 'PGRST116') { // PGRST116 indica "no rows found"
                console.error('Erro ao buscar perfil:', error.message);
                showToast('Erro ao carregar perfil do usuário.', 'error');
                state.profile = null;
            } else if (data) {
                state.profile = data;
            } else {
                console.warn('Nenhum perfil encontrado para o usuário. Redirecionando para login.');
                showToast('Perfil de usuário não encontrado. Por favor, crie um ou entre com outro usuário.', 'error');
                await supabase.auth.signOut(); // Força o logout se o perfil não for encontrado
            }
        }

        // --- Gerenciamento de Rotas e Abas ---
        /**
         * Ativa uma aba específica e a define como a aba atual.
         * @param {string} tabId - O ID da aba a ser ativada (ex: 'dashboard-tab').
         */
        function activateTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            state.currentTab = tabId;
            // Atualiza a hash na URL para permitir links diretos/atualizações
            window.location.hash = tabId.replace('-tab', '');
        }

        /**
         * Renderiza as abas de navegação com base no perfil do usuário.
         */
        function renderNavigationTabs() {
            const navTabsContainer = document.getElementById('nav-tabs');
            navTabsContainer.innerHTML = ''; // Limpa as abas existentes

            const tabs = [
                { id: 'dashboard-tab', label: 'Dashboard', roles: ['admin', 'operacional'] },
                { id: 'inventory-tab', label: 'Estoque', roles: ['admin',] },
                { id: 'consume-tab', label: 'Consumir', roles: ['admin', 'operacional'] },
                { id: 'add-item-tab', label: 'Adicionar Item', roles: ['admin'] },
                { id: 'report-tab', label: 'Relatório', roles: ['admin'] },
                { id: 'history-tab', label: 'Histórico', roles: ['admin'] },
            ];

            tabs.forEach(tab => {
                // Verifica se o usuário tem permissão para ver esta aba
                if (state.profile && tab.roles.includes(state.profile.role)) {
                    const button = document.createElement('button');
                    button.id = `nav-${tab.id.replace('-tab', '')}`;
                    button.className = `py-2 px-4 rounded-lg font-medium transition duration-300 ease-in-out ${state.currentTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 hover:bg-gray-100'}`;
                    button.textContent = tab.label;
                    button.onclick = () => {
                        activateTab(tab.id); // Ativa a aba clicada
                        renderCurrentTab(); // Renderiza o conteúdo da nova aba
                    };
                    navTabsContainer.appendChild(button);
                }
            });
        }

        /**
         * Renderiza o conteúdo da aba atualmente ativa, buscando dados conforme necessário.
         */
        async function renderCurrentTab() {
            switch (state.currentTab) {
                case 'dashboard-tab':
                    await fetchDashboardData();
                    break;
                case 'inventory-tab':
                    await fetchItems();
                    break;
                case 'consume-tab':
                    await fetchItemsForConsume();
                    break;
                case 'report-tab':
                    await fetchLowStockReport();
                    break;
                case 'history-tab':
                    await fetchTransactions();
                    break;
                case 'add-item-tab':
                    resetItemForm(); // Reseta o formulário ao ir para a aba de adicionar/editar
                    break;
            }
            renderNavigationTabs(); // Re-renderiza as abas para atualizar o estado ativo
        }

        // --- Funções de Busca de Dados ---
        /**
         * Busca todos os dados essenciais para a aplicação (itens, transações, dashboard).
         */
        async function fetchAllData() {
            if (state.profile) {
                await fetchItems(); // Busca itens
                if (state.profile.role === 'admin') {
                    await fetchTransactions(); // Busca transações (apenas para admin)
                }
                await fetchDashboardData(); // Busca dados do dashboard
            }
        }

        // --- Módulo Dashboard ---
        let mostConsumedChartInstance = null; // Instância do gráfico de itens mais consumidos
        let stockStatusChartInstance = null; // Instância do gráfico de status do estoque

        /**
         * Busca dados para o dashboard (estatísticas, itens mais consumidos, status do estoque).
         */
        async function fetchDashboardData() {
            showLoading();
            // Busca dados de itens
            const { data: items, error: itemsError } = await supabase.from('items').select('*');
            // Busca dados de transações
            const { data: transactions, error: transactionsError } = await supabase.from('transactions').select('*');
            // Chama a função RPC para obter os itens mais consumidos
            const { data: topConsumed, error: topConsumedError } = await supabase.rpc('get_top_consumed_items', { limit_count: 5 });

            hideLoading();

            if (itemsError || transactionsError || topConsumedError) {
                console.error('Erro ao buscar dados do dashboard:', itemsError || transactionsError || topConsumedError);
                showToast('Erro ao carregar dados do dashboard.', 'error');
                return;
            }

            // Calcula as estatísticas do dashboard
            const totalItems = items.length;
            const lowStockItems = items.filter(item => item.quantity <= item.min_quantity && item.quantity > 0);
            const criticalItems = items.filter(item => item.quantity === 0);
            const monthlyConsumption = transactions
                .filter(t => t.type === 'saída' && new Date(t.created_at).getMonth() === new Date().getMonth())
                .reduce((sum, t) => sum + t.quantity, 0);

            state.dashboardStats = {
                totalItems: totalItems,
                lowStock: lowStockItems.length,
                criticalItems: criticalItems.length,
                monthlyConsumption: monthlyConsumption
            };

            // Processa os itens mais consumidos
            state.topConsumedItems = topConsumed;

            // Processa os dados para o gráfico de pizza de status do estoque
            const normalCount = items.filter(item => item.quantity > item.min_quantity).length;
            const lowCount = lowStockItems.length;
            const criticalCount = criticalItems.length;
            state.stockStatusData = {
                normal: normalCount,
                low: lowCount,
                critical: criticalCount
            };

            renderDashboard(); // Renderiza o dashboard com os dados atualizados
        }

        /**
         * Renderiza os cards de estatísticas no dashboard.
         */
        function renderDashboard() {
            const statsContainer = document.getElementById('dashboard-stats');
            statsContainer.innerHTML = ''; // Limpa os cards existentes

            const stats = [
                { label: 'Total de Itens', value: state.dashboardStats.totalItems, color: 'bg-blue-500', icon: '<svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM13 7a2 2 0 00-2-2h2a2 2 0 002 2V5a2 2 0 00-2-2h-2zM11 15a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z"></path></svg>' },
                { label: 'Estoque Baixo', value: state.dashboardStats.lowStock, color: 'bg-blue-400', icon: '<svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M8.257 3.324a1 1 0 01.993-.057l7.5 4.5a1 1 0 010 1.63L9.257 16.73a1 1 0 01-1.026-.048L.775 9.072a1 1 0 010-1.63l7.5-4.5z" clip-rule="evenodd"></path></svg>' },
                { label: 'Itens Críticos', value: state.dashboardStats.criticalItems, color: 'bg-orange-600', icon: '<svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>' },
                { label: 'Consumo Mensal', value: state.dashboardStats.monthlyConsumption, color: 'bg-blue-600', icon: '<svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M3 3a1 1 0 000 2h11.586l-4.293 4.293a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 10l4.293-4.293A1 1 0 0014 4H3z" clip-rule="evenodd"></path></svg>' }
            ];

            stats.forEach(stat => {
                const card = document.createElement('div');
                card.className = `${stat.color} text-white rounded-lg p-6 shadow-md flex items-center space-x-4`;
                card.innerHTML = `
                    <div class="p-3 rounded-full bg-white bg-opacity-30">
                        ${stat.icon}
                    </div>
                    <div>
                        <div class="text-3xl font-bold">${stat.value}</div>
                        <div class="text-sm">${stat.label}</div>
                    </div>
                `;
                statsContainer.appendChild(card);
            });

            renderMostConsumedChart(); // Renderiza o gráfico de barras
            renderStockStatusChart(); // Renderiza o gráfico de pizza
        }

        /**
         * Renderiza o gráfico de barras dos itens mais consumidos.
         */
        function renderMostConsumedChart() {
            const ctx = document.getElementById('most-consumed-chart').getContext('2d');
            const labels = state.topConsumedItems.map(item => `${item.item_name} (${item.unit})`);
            const data = state.topConsumedItems.map(item => item.total_consumed);
            const backgroundColors = data.map(() => `hsla(${Math.random() * 360}, 70%, 70%, 0.8)`); // Cores aleatórias

            if (mostConsumedChartInstance) {
                mostConsumedChartInstance.destroy(); // Destrói a instância anterior para evitar sobreposição
            }

            mostConsumedChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Quantidade Consumida',
                        data: data,
                        backgroundColor: backgroundColors,
                        borderColor: backgroundColors.map(color => color.replace('0.8', '1')),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Quantidade'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Item'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }

        /**
         * Renderiza o gráfico de pizza do status do estoque.
         */
        function renderStockStatusChart() {
            const ctx = document.getElementById('stock-status-chart').getContext('2d');
            const data = [
                state.stockStatusData.normal,
                state.stockStatusData.low,
                state.stockStatusData.critical
            ];
            const labels = ['Normal', 'Baixo', 'Crítico'];
            const backgroundColors = ['#22C55E', '#FBBF24', '#EF4444']; // Verde, Amarelo, Vermelho

            if (stockStatusChartInstance) {
                stockStatusChartInstance.destroy(); // Destrói a instância anterior
            }

            stockStatusChartInstance = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: backgroundColors,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed !== null) {
                                        label += context.parsed;
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
        }

        // --- Módulo de Gestão de Estoque ---
        /**
         * Busca os itens do estoque com base nos filtros de busca e status/fornecedor.
         */
        async function fetchItems() {
            showLoading();
            let query = supabase.from('items').select('*');

            if (state.inventorySearchTerm) {
                query = query.ilike('name', `%${state.inventorySearchTerm}%`);
            }
            // A filtragem por fornecedor é aplicada após a busca para evitar complexidade na query Supabase para este exemplo
            // Se o RLS estiver configurado corretamente, o usuário só verá o que tem permissão.

            const { data, error } = await query.order('name', { ascending: true });
            hideLoading();

            if (error) {
                console.error('Erro ao buscar itens:', error.message);
                showToast('Erro ao carregar itens.', 'error');
                return;
            }
            // Adiciona o status do item (normal, baixo, crítico)
            state.items = data.map(item => ({
                ...item,
                status: getItemStatus(item.quantity, item.min_quantity)
            }));
            renderInventory(); // Renderiza a lista de itens
            populateSupplierFilter(); // Popula o filtro de fornecedores
        }

        /**
         * Determina o status de um item com base na quantidade atual e mínima.
         * @param {number} quantity - Quantidade atual do item.
         * @param {number} minQuantity - Quantidade mínima do item.
         * @returns {'normal'|'low'|'critical'} O status do item.
         */
        function getItemStatus(quantity, minQuantity) {
            if (quantity === 0) return 'critical';
            if (quantity <= minQuantity) return 'low';
            return 'normal';
        }

        /**
         * Retorna a classe CSS para a cor do status.
         * @param {string} status - O status do item.
         * @returns {string} Classes Tailwind CSS para a cor.
         */
        function getStatusColorClass(status) {
            switch (status) {
                case 'normal': return 'bg-green-100 text-green-800';
                case 'low': return 'bg-yellow-100 text-yellow-800';
                case 'critical': return 'bg-red-100 text-red-800';
                default: return 'bg-gray-100 text-gray-800';
            }
        }

        /**
         * Popula o dropdown de filtro de fornecedores com os fornecedores únicos dos itens.
         */
        function populateSupplierFilter() {
            const supplierSelect = document.getElementById('inventory-filter-supplier');
            supplierSelect.innerHTML = '<option value="all">Todos os Fornecedores</option>'; // Reseta as opções

            const uniqueSuppliers = [...new Set(state.items.map(item => item.supplier))].sort();
            uniqueSuppliers.forEach(supplier => {
                const option = document.createElement('option');
                option.value = supplier;
                option.textContent = supplier;
                supplierSelect.appendChild(option);
            });

            supplierSelect.value = state.inventoryFilterSupplier; // Define o valor atualmente selecionado
        }

        /**
         * Renderiza a tabela de itens para desktop e os cards para mobile, aplicando os filtros.
         */
        function renderInventory() {
            const tableBody = document.getElementById('inventory-table-body');
            const mobileCardsContainer = document.getElementById('mobile-item-cards');
            tableBody.innerHTML = '';
            mobileCardsContainer.innerHTML = '';

            const filteredItems = state.items.filter(item => {
                const matchesStatus = state.inventoryFilterStatus === 'all' || item.status === state.inventoryFilterStatus;
                const matchesSupplier = state.inventoryFilterSupplier === 'all' || item.supplier === state.inventoryFilterSupplier;
                return matchesStatus && matchesSupplier;
            });

            // Exibe ou oculta o estado vazio
            if (filteredItems.length === 0) {
                document.getElementById('inventory-empty-state').classList.remove('hidden');
            } else {
                document.getElementById('inventory-empty-state').classList.add('hidden');
            }

            filteredItems.forEach(item => {
                // Linha da Tabela para Desktop
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50';
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.quantity}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.min_quantity}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.unit}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.supplier}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColorClass(item.status)}">
                            ${item.status === 'normal' ? 'Normal' : item.status === 'low' ? 'Baixo' : 'Crítico'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium admin-only">
                        ${state.profile && state.profile.role === 'admin' ? `
                            <button data-id="${item.id}" class="edit-item-button text-indigo-600 hover:text-indigo-900 mr-4">Editar</button>
                            <button data-id="${item.id}" class="delete-item-button text-red-600 hover:text-red-900">Excluir</button>
                        ` : ''}
                    </td>
                `;
                tableBody.appendChild(row);

                // Card para Mobile
                const mobileCard = document.createElement('div');
                mobileCard.className = `bg-white rounded-lg shadow-md p-4 space-y-2 border-l-4 ${item.status === 'normal' ? 'border-green-500' : item.status === 'low' ? 'border-yellow-500' : 'border-red-500'}`;
                mobileCard.innerHTML = `
                    <h3 class="text-lg font-semibold text-gray-800">${item.name}</h3>
                    <p class="text-sm text-gray-600">Qtd: ${item.quantity} | Mín: ${item.min_quantity} ${item.unit}</p>
                    <p class="text-sm text-gray-600">Fornecedor: ${item.supplier}</p>
                    <div class="flex justify-between items-center mt-2">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColorClass(item.status)}">
                            ${item.status === 'normal' ? 'Normal' : item.status === 'low' ? 'Baixo' : 'Crítico'}
                        </span>
                        ${state.profile && state.profile.role === 'admin' ? `
                            <div class="flex space-x-2">
                                <button data-id="${item.id}" class="edit-item-button text-indigo-600 hover:text-indigo-900 text-sm">Editar</button>
                                <button data-id="${item.id}" class="delete-item-button text-red-600 hover:text-red-900 text-sm">Excluir</button>
                            </div>
                        ` : ''}
                    </div>
                `;
                mobileCardsContainer.appendChild(mobileCard);
            });

            // Adiciona listeners de evento para botões de editar/excluir (apenas para admin)
            if (state.profile && state.profile.role === 'admin') {
                document.querySelectorAll('.edit-item-button').forEach(button => {
                    button.onclick = (e) => editItem(e.target.dataset.id);
                });
                document.querySelectorAll('.delete-item-button').forEach(button => {
                    button.onclick = (e) => deleteItem(e.target.dataset.id);
                });
                document.getElementById('add-item-button').classList.remove('hidden');
                document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
            } else {
                document.getElementById('add-item-button').classList.add('hidden');
                document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
            }
        }

        // Elementos do Formulário de Adicionar/Editar Item
        const itemForm = document.getElementById('item-form');
        const itemIdField = document.getElementById('item-id-field');
        const itemNameInput = document.getElementById('item-name');
        const itemQuantityInput = document.getElementById('item-quantity');
        const itemMinQuantityInput = document.getElementById('item-min-quantity');
        const itemUnitInput = document.getElementById('item-unit');
        const itemSupplierInput = document.getElementById('item-supplier');

        const itemNameError = document.getElementById('item-name-error');
        const itemQuantityError = document.getElementById('item-quantity-error');
        const itemMinQuantityError = document.getElementById('item-min-quantity-error');
        const itemUnitError = document.getElementById('item-unit-error');
        const itemSupplierError = document.getElementById('item-supplier-error');

        /**
         * Reseta o formulário de adicionar/editar item.
         */
        function resetItemForm() {
            itemIdField.value = '';
            itemNameInput.value = '';
            itemQuantityInput.value = 0;
            itemMinQuantityInput.value = 1;
            itemUnitInput.value = '';
            itemSupplierInput.value = '';
            clearItemFormErrors();
        }

        /**
         * Limpa as mensagens de erro do formulário de adicionar/editar item.
         */
        function clearItemFormErrors() {
            itemNameError.textContent = '';
            itemQuantityError.textContent = '';
            itemMinQuantityError.textContent = '';
            itemUnitError.textContent = '';
            itemSupplierError.textContent = '';
        }

        /**
         * Manipula o envio do formulário de adicionar/editar item.
         * @param {Event} event - O evento de envio do formulário.
         */
        async function submitItemForm(event) {
            event.preventDefault();
            clearItemFormErrors();

            const isEditing = !!itemIdField.value;

            const itemData = {
                name: itemNameInput.value.trim(),
                quantity: parseInt(itemQuantityInput.value, 10),
                min_quantity: parseInt(itemMinQuantityInput.value, 10),
                unit: itemUnitInput.value.trim(),
                supplier: itemSupplierInput.value.trim()
            };

            // Validação básica do formulário
            let isValid = true;
            if (!itemData.name) { itemNameError.textContent = 'Nome é obrigatório.'; isValid = false; }
            if (isNaN(itemData.quantity) || itemData.quantity < 0) { itemQuantityError.textContent = 'Quantidade deve ser um número não negativo.'; isValid = false; }
            if (isNaN(itemData.min_quantity) || itemData.min_quantity < 1) { itemMinQuantityError.textContent = 'Quantidade mínima deve ser pelo menos 1.'; isValid = false; }
            if (!itemData.unit) { itemUnitError.textContent = 'Unidade é obrigatória.'; isValid = false; }
            if (!itemData.supplier) { itemSupplierError.textContent = 'Fornecedor é obrigatório.'; isValid = false; }

            if (!isValid) {
                showToast('Preencha todos os campos corretamente.', 'error');
                return;
            }

            showLoading();
            let response;
            if (isEditing) {
                // Atualiza um item existente
                response = await supabase.from('items').update(itemData).eq('id', itemIdField.value);
            } else {
                // Adiciona um novo item
                response = await supabase.from('items').insert([itemData]).select(); // .select() para obter o item inserido
            }
            hideLoading();

            if (response.error) {
                console.error('Erro ao salvar item:', response.error.message);
                showToast(`Erro ao ${isEditing ? 'atualizar' : 'adicionar'} item: ${response.error.message}`, 'error');
            } else {
                showToast(`Item ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!`, 'success');
                resetItemForm();
                activateTab('inventory-tab'); // Volta para a aba de estoque
                await fetchItems(); // Atualiza a lista de itens
                // Se for uma adição, registra a transação de entrada
                if (!isEditing && response.data && response.data.length > 0) {
                    await recordTransaction(response.data[0].id, itemData.name, 'entrada', itemData.quantity, state.profile.name, itemData.supplier, itemData.unit);
                }
            }
        }

        /**
         * Preenche o formulário para edição de um item.
         * @param {string} itemId - O ID do item a ser editado.
         */
        async function editItem(itemId) {
            const item = state.items.find(i => i.id === itemId);
            if (item) {
                itemIdField.value = item.id;
                itemNameInput.value = item.name;
                itemQuantityInput.value = item.quantity;
                itemMinQuantityInput.value = item.min_quantity;
                itemUnitInput.value = item.unit;
                itemSupplierInput.value = item.supplier;
                activateTab('add-item-tab'); // Muda para a aba de adicionar/editar item
            } else {
                showToast('Item não encontrado para edição.', 'error');
            }
        }

        /**
         * Exclui um item do estoque.
         * @param {string} itemId - O ID do item a ser excluído.
         */
        async function deleteItem(itemId) {
            if (!confirm('Tem certeza que deseja excluir este item? Esta ação é irreversível.')) {
                return;
            }

            showLoading();
            const itemToDelete = state.items.find(i => i.id === itemId);
            const { error } = await supabase.from('items').delete().eq('id', itemId);
            hideLoading();

            if (error) {
                console.error('Erro ao excluir item:', error.message);
                showToast('Erro ao excluir item.', 'error');
            } else {
                showToast('Item excluído com sucesso!', 'success');
                state.items = state.items.filter(item => item.id !== itemId); // Remove o item do estado local
                renderInventory(); // Re-renderiza a lista de itens
                // Registra a transação de exclusão
                if (itemToDelete) {
                    await recordTransaction(itemToDelete.id, itemToDelete.name, 'exclusão', itemToDelete.quantity, state.profile.name, itemToDelete.supplier, itemToDelete.unit);
                }
            }
        }

        // --- Módulo de Consumo de Item ---
        const consumeForm = document.getElementById('consume-form');
        const consumeItemSelect = document.getElementById('consume-item-select');
        const consumeQuantityInput = document.getElementById('consume-quantity');
        const consumeAvailableQuantityDisplay = document.getElementById('available-quantity-display');

        const consumeItemSelectError = document.getElementById('consume-item-select-error');
        const consumeQuantityError = document.getElementById('consume-quantity-error');

        /**
         * Limpa as mensagens de erro do formulário de consumo.
         */
        function clearConsumeFormErrors() {
            consumeItemSelectError.textContent = '';
            consumeQuantityError.textContent = '';
        }

        /**
         * Busca os itens para popular o dropdown de seleção no formulário de consumo.
         */
        async function fetchItemsForConsume() {
            showLoading();
            const { data, error } = await supabase.from('items').select('*').order('name', { ascending: true });
            hideLoading();

            if (error) {
                console.error('Erro ao buscar itens para consumo:', error.message);
                showToast('Erro ao carregar itens para consumo.', 'error');
                return;
            }

            state.items = data; // Atualiza o estado global de itens
            populateConsumeItemSelect(); // Popula o dropdown
        }

        /**
         * Popula o dropdown de seleção de item no formulário de consumo.
         */
        function populateConsumeItemSelect() {
            consumeItemSelect.innerHTML = '<option value="">Selecione um item</option>';
            state.items.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = `${item.name} (Qtd: ${item.quantity} ${item.unit})`;
                consumeItemSelect.appendChild(option);
            });
            consumeAvailableQuantityDisplay.textContent = '0'; // Reseta a quantidade disponível exibida
            consumeQuantityInput.value = ''; // Reseta o campo de quantidade
            clearConsumeFormErrors(); // Limpa erros
        }

        // Listener de mudança na seleção de item no formulário de consumo
        consumeItemSelect.onchange = () => {
            const selectedItemId = consumeItemSelect.value;
            const selectedItem = state.items.find(item => item.id === selectedItemId);
            if (selectedItem) {
                consumeAvailableQuantityDisplay.textContent = selectedItem.quantity;
                consumeQuantityInput.max = selectedItem.quantity; // Define o máximo para o campo de entrada
            } else {
                consumeAvailableQuantityDisplay.textContent = '0';
                consumeQuantityInput.max = 0;
            }
            clearConsumeFormErrors();
        };

        /**
         * Manipula o envio do formulário de consumo de item.
         * @param {Event} event - O evento de envio do formulário.
         */
        async function submitConsumeForm(event) {
            event.preventDefault();
            clearConsumeFormErrors();

            const itemId = consumeItemSelect.value;
            const quantityToConsume = parseInt(consumeQuantityInput.value, 10);

            let isValid = true;
            if (!itemId) { consumeItemSelectError.textContent = 'Selecione um item.'; isValid = false; }
            if (isNaN(quantityToConsume) || quantityToConsume <= 0) { consumeQuantityError.textContent = 'Quantidade inválida.'; isValid = false; }

            const selectedItem = state.items.find(item => item.id === itemId);
            if (selectedItem && quantityToConsume > selectedItem.quantity) {
                consumeQuantityError.textContent = 'Não é possível consumir mais do que a quantidade disponível.';
                isValid = false;
            }

            if (!isValid) {
                showToast('Preencha os campos corretamente para consumir.', 'error');
                return;
            }

            showLoading();
            // Atualiza a quantidade do item no banco de dados
            const newQuantity = selectedItem.quantity - quantityToConsume;
            const { error: updateError } = await supabase
                .from('items')
                .update({ quantity: newQuantity })
                .eq('id', itemId);

            if (updateError) {
                console.error('Erro ao consumir item:', updateError.message);
                showToast('Erro ao registrar consumo.', 'error');
                hideLoading();
                return;
            }

            // Registra a transação de saída
            await recordTransaction(itemId, selectedItem.name, 'saída', quantityToConsume, state.profile.name, selectedItem.supplier, selectedItem.unit);

            hideLoading();
            showToast('Consumo registrado com sucesso!', 'success');
            // Reseta o formulário de consumo
            consumeItemSelect.value = '';
            consumeQuantityInput.value = '';
            consumeAvailableQuantityDisplay.textContent = '0';
            await fetchItems(); // Atualiza a lista de itens no estoque
            await fetchDashboardData(); // Atualiza as estatísticas do dashboard
            if (state.profile.role === 'admin') {
                await fetchTransactions(); // Atualiza o histórico de transações para admin
            }
        }

        /**
         * Registra uma transação no histórico.
         * @param {string} itemId - ID do item envolvido na transação.
         * @param {string} itemName - Nome do item envolvido na transação.
         * @param {'entrada'|'saída'|'exclusão'} type - Tipo da transação.
         * @param {number} quantity - Quantidade da transação.
         * @param {string} userName - Nome do usuário que realizou a transação.
         * @param {string} supplier - Fornecedor do item.
         * @param {string} unit - Unidade de medida do item.
         */
        async function recordTransaction(itemId, itemName, type, quantity, userName, supplier, unit) {
            const { error } = await supabase.from('transactions').insert([{
                item_id: itemId,
                item_name: itemName,
                type: type,
                quantity: quantity,
                user_name: userName,
                supplier: supplier,
                unit: unit
            }]);

            if (error) {
                console.error('Erro ao registrar transação:', error.message);
                showToast('Erro ao registrar transação no histórico.', 'error');
            }
        }

        // --- Módulo de Relatórios (Apenas Admin) ---
        /**
         * Busca os itens com estoque baixo para o relatório.
         */
        async function fetchLowStockReport() {
            if (state.profile && state.profile.role !== 'admin') return; // Apenas admin pode acessar

            showLoading();
            // Filtra os itens onde a quantidade é menor ou igual à quantidade mínima.
            // Nota: Para filtrar no Supabase usando `supabase.col` para comparação de colunas, seria necessário uma função ou view no lado do DB.
            // Para simplicidade em JS puro, estamos buscando todos e filtrando localmente.
            const { data, error } = await supabase
                .from('items')
                .select('*')
                .order('name', { ascending: true });
            hideLoading();

            if (error) {
                console.error('Erro ao buscar relatório de estoque baixo:', error.message);
                showToast('Erro ao carregar relatório de estoque baixo.', 'error');
                return;
            }

            state.lowStockItems = data.filter(item => item.quantity <= item.min_quantity); // Filtra localmente
            renderLowStockReport(); // Renderiza o relatório
        }

        /**
         * Renderiza a tabela do relatório de estoque baixo.
         */
        function renderLowStockReport() {
            const tableBody = document.getElementById('low-stock-report-table-body');
            tableBody.innerHTML = '';

            if (state.lowStockItems.length === 0) {
                document.getElementById('low-stock-empty-state').classList.remove('hidden');
            } else {
                document.getElementById('low-stock-empty-state').classList.add('hidden');
            }

            state.lowStockItems.forEach(item => {
                const suggestedPurchase = item.min_quantity - item.quantity > 0 ? item.min_quantity - item.quantity : 0;
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50';
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.quantity}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.min_quantity}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.unit}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.supplier}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${suggestedPurchase} ${item.unit}</td>
                `;
                tableBody.appendChild(row);
            });
        }

        /**
         * Exporta o relatório de estoque baixo para um arquivo Excel.
         */
        function exportLowStockToExcel() {
            const ws_data = [
                ["Nome do Item", "Quantidade Atual", "Quantidade Mínima", "Unidade", "Fornecedor", "Sugestão de Compra"]
            ];
            state.lowStockItems.forEach(item => {
                const suggestedPurchase = item.min_quantity - item.quantity > 0 ? item.min_quantity - item.quantity : 0;
                ws_data.push([
                    item.name,
                    item.quantity,
                    item.min_quantity,
                    item.unit,
                    item.supplier,
                    suggestedPurchase + ' ' + item.unit
                ]);
            });

            const ws = XLSX.utils.aoa_to_sheet(ws_data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Estoque Baixo");
            XLSX.writeFile(wb, "relatorio_estoque_baixo.xlsx");
            showToast('Relatório de estoque baixo exportado!', 'success');
        }

        // --- Módulo de Histórico de Transações (Apenas Admin) ---
        /**
         * Busca o histórico completo de transações (apenas para admins).
         */
        async function fetchTransactions() {
            if (state.profile && state.profile.role !== 'admin') return; // Apenas admin pode acessar

            showLoading();
            const { data, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
            hideLoading();

            if (error) {
                console.error('Erro ao buscar histórico de transações:', error.message);
                showToast('Erro ao carregar histórico de transações.', 'error');
                return;
            }
            state.transactions = data;
            renderTransactions(); // Renderiza a tabela de transações
        }

        /**
         * Renderiza a tabela do histórico de transações.
         */
        function renderTransactions() {
            const tableBody = document.getElementById('transactions-table-body');
            tableBody.innerHTML = '';

            if (state.transactions.length === 0) {
                document.getElementById('transactions-empty-state').classList.remove('hidden');
            } else {
                document.getElementById('transactions-empty-state').classList.add('hidden');
            }

            state.transactions.forEach(transaction => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50';
                const date = new Date(transaction.created_at).toLocaleString('pt-BR'); // Formata a data
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${date}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${transaction.item_name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${transaction.type === 'entrada' ? 'Entrada' : transaction.type === 'saída' ? 'Saída' : 'Exclusão'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${transaction.quantity} ${transaction.unit}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${transaction.user_name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${transaction.supplier || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${transaction.unit}</td>
                `;
                tableBody.appendChild(row);
            });
        }

        // --- Listeners de Eventos e Configuração Inicial ---
        document.addEventListener('DOMContentLoaded', () => {
            // Lógica do Formulário de Autenticação (já injetada no HTML)
            const loginForm = document.getElementById('login-form');
            const emailInput = document.getElementById('email-address');
            const passwordInput = document.getElementById('password');
            const loginEmailError = document.getElementById('login-email-error');
            const loginPasswordError = document.getElementById('login-password-error');
            const registerLink = document.getElementById('register-link');

            /**
             * Limpa as mensagens de erro do formulário de login.
             */
            function clearLoginErrors() {
                loginEmailError.textContent = '';
                loginPasswordError.textContent = '';
            }

            // Listener para o envio do formulário de login
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                clearLoginErrors();
                const email = emailInput.value.trim();
                const password = passwordInput.value.trim();

                let isValid = true;
                if (!email) { loginEmailError.textContent = 'Email é obrigatório.'; isValid = false; }
                if (!password) { loginPasswordError.textContent = 'Senha é obrigatória.'; isValid = false; }

                if (!isValid) {
                    showToast('Preencha os campos de login.', 'error');
                    return;
                }

                showLoading();
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                hideLoading();

                if (error) {
                    console.error('Erro de login:', error.message);
                    showToast(`Erro de login: ${error.message}`, 'error');
                    if (error.message.includes('Invalid login credentials')) {
                        loginPasswordError.textContent = 'Credenciais inválidas.';
                    } else {
                        loginEmailError.textContent = error.message;
                    }
                } else {
                    showToast('Login bem-sucedido!', 'success');
                }
            });

            // Listener para o link de cadastro
            registerLink.addEventListener('click', async (e) => {
                e.preventDefault();
                clearLoginErrors();
                const email = emailInput.value.trim();
                const password = passwordInput.value.trim();

                let isValid = true;
                if (!email) { loginEmailError.textContent = 'Email é obrigatório.'; isValid = false; }
                if (!password) { loginPasswordError.textContent = 'Senha é obrigatória.'; isValid = false; }
                if (password.length < 6) { loginPasswordError.textContent = 'Senha deve ter no mínimo 6 caracteres.'; isValid = false; }

                if (!isValid) {
                    showToast('Preencha os campos de cadastro corretamente.', 'error');
                    return;
                }

                showLoading();
                const { data, error } = await supabase.auth.signUp({ email, password });
                hideLoading();

                if (error) {
                    console.error('Erro de cadastro:', error.message);
                    showToast(`Erro de cadastro: ${error.message}`, 'error');
                } else if (data.user) {
                    // Cria um perfil padrão 'operacional' para o novo usuário
                    const { error: profileError } = await supabase.from('profiles').insert([
                        { id: data.user.id, name: email.split('@')[0], role: 'operacional' }
                    ]);
                    if (profileError) {
                        console.error('Erro ao criar perfil:', profileError.message);
                        showToast('Conta criada, mas erro ao criar perfil. Tente novamente.', 'error');
                        await supabase.auth.signOut(); // Força o logout se a criação do perfil falhar
                    } else {
                        showToast('Cadastro realizado com sucesso! Você foi logado como operacional.', 'success');
                        // O signUp do Supabase já realiza o login automaticamente
                    }
                }
            });

            // Listeners de Eventos Gerais da Aplicação
            document.getElementById('logout-button').addEventListener('click', logout);
            itemForm.addEventListener('submit', submitItemForm);
            consumeForm.addEventListener('submit', submitConsumeForm);

            // Filtros e busca da página de estoque
            document.getElementById('inventory-search').addEventListener('input', (e) => {
                state.inventorySearchTerm = e.target.value;
                fetchItems(); // Refreshes items with new search term
            });
            document.getElementById('inventory-filter-status').addEventListener('change', (e) => {
                state.inventoryFilterStatus = e.target.value;
                renderInventory(); // Re-renderiza o inventário com o filtro de status aplicado
            });
            document.getElementById('inventory-filter-supplier').addEventListener('change', (e) => {
                state.inventoryFilterSupplier = e.target.value;
                renderInventory(); // Re-renderiza o inventário com o filtro de fornecedor aplicado
            });
            document.getElementById('export-low-stock-excel').addEventListener('click', exportLowStockToExcel);
            document.getElementById('add-item-button').addEventListener('click', () => {
                resetItemForm();
                activateTab('add-item-tab'); // Ativa a aba de adicionar/editar item
            });

            // Lidar com a hash da URL para carregar a aba inicial (ex: #history)
            const initialHash = window.location.hash.replace('#', '');
            if (initialHash && document.getElementById(`${initialHash}-tab`)) {
                state.currentTab = `${initialHash}-tab`;
            }

            // Inicia a verificação de autenticação
            initialAuthCheck();
        });
