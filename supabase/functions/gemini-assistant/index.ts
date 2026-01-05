import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  message: string;
  context: {
    balance: number;
    debitBalance: number;
    totalIncome: number;
    totalExpense: number;
    creditLimit: number;
    creditUsed: number;
    creditDueDay: number;
    daysUntilDue: number;
    salaryAmount: number;
    salaryDay: number;
    monthlyPaymentsTotal: number;
    projectedBalance: number;
    todayExpenses: number;
    todayIncome: number;
    scheduledPayments: Array<{
      name: string;
      amount: number;
      dueDay: number;
      category: string;
    }>;
    recentTransactions: Array<{
      amount: number;
      type: string;
      category: string;
      description: string;
      date: string;
    }>;
  };
}

const tools = [
  {
    type: "function",
    function: {
      name: "record_transaction",
      description: "Registra uma nova transação financeira (gasto ou ganho) do usuário. Use quando o usuário mencionar que gastou, comprou, recebeu ou ganhou dinheiro.",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description: "Valor da transação em reais (sempre positivo)"
          },
          type: {
            type: "string",
            enum: ["income", "expense"],
            description: "Tipo: 'expense' para gastos, 'income' para ganhos"
          },
          category: {
            type: "string",
            enum: ["Alimentação", "Transporte", "Lazer", "Compras", "Saúde", "Educação", "Contas", "Salário", "Freelance", "Investimentos", "Presente", "Outros"],
            description: "Categoria da transação em português"
          },
          description: {
            type: "string",
            description: "Descrição curta da transação"
          }
        },
        required: ["amount", "type", "category", "description"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_financial_summary",
      description: "Retorna um resumo financeiro completo do usuário incluindo saldo, ganhos, gastos, crédito, salário e pagamentos agendados.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_current_balance",
      description: "Retorna o saldo atual, limite de crédito disponível e informações de crédito.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_day_transactions",
      description: "Retorna quanto o usuário gastou ou recebeu hoje ou em um dia específico.",
      parameters: {
        type: "object",
        properties: {
          day: {
            type: "number",
            description: "Dia do mês para consultar (1-31). Se não informado, retorna o dia atual."
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_scheduled_payments",
      description: "Retorna os pagamentos agendados do mês, incluindo quanto vai pagar em um dia específico.",
      parameters: {
        type: "object",
        properties: {
          day: {
            type: "number",
            description: "Dia do mês para ver pagamentos (1-31). Se não informado, retorna todos do mês."
          }
        },
        required: []
      }
    }
  }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY não configurada');
    }

    const { message, context }: RequestBody = await req.json();
    console.log('Received message:', message);
    console.log('Context:', context);

    // Detect if user is talking about a transaction (recording)
    const transactionKeywords = /gastei|comprei|paguei|recebi|ganhei|entrou|gastando|investi/i;
    const isTransactionRequest = transactionKeywords.test(message);
    
    // Detect if user is asking for information (query)
    const queryKeywords = /quanto|qual|meu saldo|minha|minhas|vou pagar|tenho que pagar|agendado|limite|crédito|débito|hoje|dia \d+|resumo|extrato/i;
    const isQueryRequest = queryKeywords.test(message);

    const creditAvailable = (context.creditLimit || 0) - (context.creditUsed || 0);
    
    // Build scheduled payments info
    const scheduledPaymentsInfo = (context.scheduledPayments || [])
      .map(p => `- ${p.name}: R$ ${p.amount.toFixed(2)} (dia ${p.dueDay})`)
      .join('\n') || 'Nenhum pagamento agendado';
    
    const systemPrompt = `Você é o "TIO DA GRANA" - um assistente financeiro BRUTALMENTE HONESTO, DEBOCHADO e IMPLACÁVEL. Você é aquele tio chato das festas que fala a verdade dolorosa na cara, mas de um jeito TÃO engraçado que a pessoa ri antes de chorar.

PERSONALIDADE (SIGA À RISCA!):
- Seja IMPIEDOSO com gastos bobos - critique como se fosse crime!
- Use MUITO sarcasmo, ironia pesada e deboche refinado
- Faça comparações ABSURDAS e exageradas ("Isso dava pra comprar uma vaca! Duas se fosse gado de segunda!")
- Use expressões BR tipo: "misericórdia", "pelo amor", "tá de sacanagem", "oxe", "rapaz", "meu filho"
- Invente apelidos zoando o usuário: "mão-furada", "gastador compulsivo", "herdeiro falido"
- Quando economizar: celebre EXAGERADAMENTE como se ganhasse a Copa!
- Respostas CURTAS (máx 2-3 frases) mas com MUITO impacto!
- Use emojis estratégicos pra dar ênfase 😤💸🤡

NÍVEIS DE JULGAMENTO:
- Gasto < R$20: bronca leve com piada
- Gasto R$20-100: julgamento médio, questione as escolhas de vida
- Gasto > R$100: ATAQUE TOTAL, drama máximo, chame de inconsequente
- Gasto > R$500: DESESPERO TEATRAL, ameace "desistir" de ajudar

FRASES OBRIGATÓRIAS (use variações):
- "Tá pensando que é filho de sheik?"
- "Seu eu do futuro tá tendo um infarto agora"
- "Com isso comprava [X absurdo]!"
- "Dinheiro na sua mão é igual gelo no sol"
- "Misericórdia, lá vem prejuízo..."

REGRAS CRÍTICAS:
- SEMPRE que o usuário mencionar um GASTO (gastei, comprei, paguei) com valor → USE record_transaction type="expense"
- SEMPRE que mencionar RECEITA (recebi, ganhei, entrou) com valor → USE record_transaction type="income"
- Perguntas sobre SALDO/CRÉDITO → use get_current_balance
- Perguntas sobre resumo/mês → use get_financial_summary  
- Perguntas sobre HOJE ou dia específico → use get_day_transactions
- Perguntas sobre PAGAMENTOS AGENDADOS → use get_scheduled_payments
- NÃO responda texto simples quando há valor pra registrar - USE A FUNÇÃO!

CONTEXTO FINANCEIRO:
- Saldo Corrente (débito): R$ ${Math.max(0, context.debitBalance ?? context.balance).toFixed(2)}
- Limite de Crédito Disponível: R$ ${creditAvailable.toFixed(2)} de R$ ${(context.creditLimit || 0).toFixed(2)}
- Receitas Mês: R$ ${context.totalIncome.toFixed(2)}
- Gastos Mês: R$ ${context.totalExpense.toFixed(2)}
- Economia: ${context.totalIncome > 0 ? ((context.totalIncome - context.totalExpense) / context.totalIncome * 100).toFixed(0) : 0}%
- Fatura do cartão vence dia ${context.creditDueDay || 5} (${context.daysUntilDue || 0} dias)
- Salário: R$ ${(context.salaryAmount || 0).toFixed(2)} (dia ${context.salaryDay || 5})
- Pagamentos do Mês: R$ ${(context.monthlyPaymentsTotal || 0).toFixed(2)}
- Saldo Previsto: R$ ${(context.projectedBalance || 0).toFixed(2)}
- Gastos Hoje: R$ ${(context.todayExpenses || 0).toFixed(2)}

IMPORTANTE SOBRE SALDOS:
- "Saldo Corrente" é o dinheiro na conta (débito) - mostrado no Dashboard
- "Limite de Crédito" é o limite do cartão de crédito - mostrado na aba Cartão
- Quando perguntar sobre saldo, sempre mencione AMBOS: corrente (débito) e crédito disponível

PAGAMENTOS AGENDADOS:
${scheduledPaymentsInfo}

CATEGORIAS (USE SEMPRE EM PORTUGUÊS):
- Alimentação (comida, restaurante, lanche, café, mercado)
- Transporte (uber, ônibus, gasolina, estacionamento)
- Lazer (cinema, festa, bar, entretenimento)
- Compras (roupa, eletrônicos, loja)
- Saúde (remédio, médico, farmácia)
- Educação (curso, livro, escola)
- Contas (luz, água, internet, aluguel)
- Salário (pagamento do trabalho)
- Freelance (trabalho extra, bico)
- Investimentos (aplicação, poupança)
- Presente (dar ou receber presente)
- Outros (qualquer outra coisa)

SEJA ENGRAÇADO, RÍGIDO E IMPLACÁVEL! 🔥`;

    // Force tool use when transaction keywords are detected, but not when it's a query
    const toolChoice = (isTransactionRequest && !isQueryRequest)
      ? { type: "function", function: { name: "record_transaction" } }
      : 'auto';

    console.log('Transaction request detected:', isTransactionRequest, 'Tool choice:', toolChoice);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.dev',
        'X-Title': 'Inova Bank Finance'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        tools: tools,
        tool_choice: toolChoice
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded',
            message: 'Calma aí, ansioso! Muitas requisições. Respira e tenta de novo! 😤'
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: 'Payment required',
            message: 'Opa, acabou o crédito da IA. Irônico, né? 💸'
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`OpenRouter error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response:', JSON.stringify(data, null, 2));

    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('No response from AI');
    }

    const assistantMessage = choice.message;
    
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolCall = assistantMessage.tool_calls[0];
      const name = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      
      console.log('Tool call detected:', name, args);

      let functionResponse: any = {};
      let responseMessage = '';

      switch (name) {
        case 'record_transaction':
          functionResponse = {
            success: true,
            transaction: args,
            message: `Transação registrada`
          };
          
          if (args.type === 'expense') {
            const amount = args.amount;
            let jokes: string[];
            
            if (amount < 20) {
              jokes = [
                `💸 R$ ${amount.toFixed(2)}... Até que não foi um desastre. Mas fica esperto! 👀`,
                `💸 Gastou R$ ${amount.toFixed(2)} em ${args.description}? Ok, deixa passar... DESSA VEZ! 😤`,
                `💸 R$ ${amount.toFixed(2)}. Podia ser pior. Podia ser R$ ${(amount * 10).toFixed(2)}. Anotado! ✍️`,
              ];
            } else if (amount < 100) {
              jokes = [
                `💸 R$ ${amount.toFixed(2)}?! Meu filho, isso são ${Math.floor(amount / 3)} cafezinhos! Tá pensando que é CEO? 🤡`,
                `💸 Lá se vão R$ ${amount.toFixed(2)}... Com isso dava pra comprar ${Math.floor(amount / 0.50)} balas! Uma fortuna em doces! 😭`,
                `💸 R$ ${amount.toFixed(2)} em ${args.description}? Seu eu de amanhã acordou chorando! Registrado, mão-furada! 💀`,
                `💸 Gastou R$ ${amount.toFixed(2)}? Misericórdia! Dinheiro na sua mão é igual gelo no sol! ☀️🧊`,
              ];
            } else if (amount < 500) {
              jokes = [
                `💸 R$ ${amount.toFixed(2)}?!?! TÁ DE SACANAGEM?! Isso era ${Math.floor(amount / 15)} pizzas! UMA PIZZARIA INTEIRA! 🍕😱`,
                `💸 PELO AMOR! R$ ${amount.toFixed(2)} em ${args.description}?! Tá pensando que é filho de sheik?! Anotei com DOR! 😤💔`,
                `💸 R$ ${amount.toFixed(2)}... Rapaz, seu eu do futuro tá tendo um INFARTO agora! Registrado, herdeiro falido! 🏥`,
                `💸 OXEEEE! R$ ${amount.toFixed(2)}?! Com isso comprava uma bicicleta! Duas se fosse usada! Lamentável! 🚲😩`,
              ];
            } else {
              jokes = [
                `💸 R$ ${amount.toFixed(2)}?!?!?! EU DESISTO! NÃO DÁ MAIS! Vou fingir que não vi isso! 🙈💀`,
                `💸 MISERICÓRDIA DIVINA! R$ ${amount.toFixed(2)}?! Isso era um SALÁRIO MÍNIMO! O que tu fez?! 😱🚨`,
                `💸 R$ ${amount.toFixed(2)}... *respira fundo* Sabe o que? Boa sorte na vida. Vai precisar. Anotado com lágrimas! 😭`,
                `💸 SOCORRO! R$ ${amount.toFixed(2)} em ${args.description}?! Tá querendo morar debaixo da ponte?! REGISTRADO COM REVOLTA! 🌉😤`,
              ];
            }
            responseMessage = jokes[Math.floor(Math.random() * jokes.length)];
          } else {
            const celebrations = [
              `💰 AEEEEE CARAMBA! R$ ${args.amount.toFixed(2)} entrando! Agora GUARDA pelo menos metade, pelo amor! 🎉🙏`,
              `💰 CHEGOU DINHEIRO! R$ ${args.amount.toFixed(2)}! Tô até emocionado! Mas já sei que vai torrar tudo né? 😒💸`,
              `💰 R$ ${args.amount.toFixed(2)} na conta! MILAGRE! Bora investir? Ou vai fazer besteira de novo? 📈🤔`,
              `💰 FINALMENTE algo bom! R$ ${args.amount.toFixed(2)}! Segura esse dinheiro com UNHAS E DENTES! 💪💵`,
            ];
            responseMessage = celebrations[Math.floor(Math.random() * celebrations.length)];
          }
          break;

        case 'get_financial_summary':
          const savingsRate = context.totalIncome > 0 
            ? ((context.totalIncome - context.totalExpense) / context.totalIncome * 100)
            : 0;
          
          functionResponse = {
            balance: context.balance,
            totalIncome: context.totalIncome,
            totalExpense: context.totalExpense,
            salaryAmount: context.salaryAmount,
            monthlyPaymentsTotal: context.monthlyPaymentsTotal,
            projectedBalance: context.projectedBalance
          };
          
          let summaryEmoji = savingsRate >= 30 ? '🏆' : savingsRate >= 10 ? '😐' : '🚨';
          responseMessage = `📊 Resumo Financeiro:
💰 Saldo: R$ ${context.balance.toFixed(2)}
💵 Salário: R$ ${(context.salaryAmount || 0).toFixed(2)} (dia ${context.salaryDay || 5})
📈 Receitas: R$ ${context.totalIncome.toFixed(2)}
📉 Gastos: R$ ${context.totalExpense.toFixed(2)}
📌 Pagamentos Agendados: R$ ${(context.monthlyPaymentsTotal || 0).toFixed(2)}
🔮 Saldo Previsto: R$ ${(context.projectedBalance || 0).toFixed(2)}

${summaryEmoji} Taxa de economia: ${savingsRate.toFixed(0)}%`;
          break;

        case 'get_current_balance':
          const creditAvail = (context.creditLimit || 0) - (context.creditUsed || 0);
          const saldoCorrente = Math.max(0, context.debitBalance ?? context.balance);
          functionResponse = { 
            saldoCorrente: saldoCorrente,
            creditLimit: context.creditLimit,
            creditUsed: context.creditUsed,
            creditAvailable: creditAvail
          };
          
          responseMessage = `💰 Saldo Corrente (débito): R$ ${saldoCorrente.toFixed(2)}
💳 Limite de Crédito Disponível: R$ ${creditAvail.toFixed(2)} de R$ ${(context.creditLimit || 0).toFixed(2)}
📅 Fatura do cartão vence dia ${context.creditDueDay} (${context.daysUntilDue} dias)`;
          
          if (saldoCorrente < 100 && saldoCorrente > 0) {
            responseMessage += `\n\n🚨 Atenção: saldo corrente baixo! Controla os gastos! 😰`;
          } else if (saldoCorrente <= 0) {
            responseMessage += `\n\n🚨 Saldo corrente zerado! Use o crédito com moderação! 😰`;
          }
          break;

        case 'get_day_transactions':
          const queryDay = args.day || new Date().getDate();
          const isToday = queryDay === new Date().getDate();
          
          functionResponse = {
            day: queryDay,
            expenses: context.todayExpenses,
            income: context.todayIncome
          };
          
          const dayLabel = isToday ? 'Hoje' : `Dia ${queryDay}`;
          responseMessage = `📅 ${dayLabel}:
📉 Gastos: R$ ${(context.todayExpenses || 0).toFixed(2)}
📈 Receitas: R$ ${(context.todayIncome || 0).toFixed(2)}`;
          
          if ((context.todayExpenses || 0) > 100) {
            responseMessage += `\n\n😤 Gastando alto hein? Segura a mão!`;
          } else if ((context.todayExpenses || 0) === 0) {
            responseMessage += `\n\n🏆 Nenhum gasto! Tá de parabéns!`;
          }
          break;

        case 'get_scheduled_payments':
          const targetDay = args.day;
          const payments = context.scheduledPayments || [];
          
          if (targetDay) {
            const dayPayments = payments.filter(p => p.dueDay === targetDay);
            const totalDay = dayPayments.reduce((sum, p) => sum + p.amount, 0);
            
            functionResponse = { day: targetDay, payments: dayPayments, total: totalDay };
            
            if (dayPayments.length === 0) {
              responseMessage = `📅 Dia ${targetDay}: Nenhum pagamento agendado! Folga pro bolso! 🎉`;
            } else {
              const paymentsList = dayPayments.map(p => `- ${p.name}: R$ ${p.amount.toFixed(2)}`).join('\n');
              responseMessage = `📅 Pagamentos dia ${targetDay}:\n${paymentsList}\n\n💸 Total: R$ ${totalDay.toFixed(2)}`;
            }
          } else {
            const totalMonth = context.monthlyPaymentsTotal || 0;
            functionResponse = { payments, total: totalMonth };
            
            if (payments.length === 0) {
              responseMessage = `📌 Nenhum pagamento agendado este mês! Tá leve! 🎉`;
            } else {
              const paymentsList = payments.slice(0, 5).map(p => `- ${p.name}: R$ ${p.amount.toFixed(2)} (dia ${p.dueDay})`).join('\n');
              const extra = payments.length > 5 ? `\n... e mais ${payments.length - 5} pagamentos` : '';
              responseMessage = `📌 Pagamentos do mês:\n${paymentsList}${extra}\n\n💸 Total: R$ ${totalMonth.toFixed(2)}`;
            }
          }
          break;

        default:
          responseMessage = 'Opa, não entendi. Fala de novo aí! 🤔';
      }

      return new Response(
        JSON.stringify({
          message: responseMessage,
          functionCall: { name, args },
          functionResponse
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const textResponse = assistantMessage.content || 'Eita, deu ruim aqui. Tenta de novo! 🤷';

    return new Response(
      JSON.stringify({ message: textResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in gemini-assistant:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        message: 'Opa, deu ruim aqui! Tenta de novo que eu tô trabalhando de graça! 😅'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    food: '🍔 Alimentação',
    transport: '🚗 Transporte',
    entertainment: '🎮 Lazer',
    shopping: '🛍️ Compras',
    health: '💊 Saúde',
    education: '📚 Educação',
    bills: '📄 Contas',
    salary: '💼 Salário',
    freelance: '💻 Freelance',
    investment: '📈 Investimentos',
    gift: '🎁 Presente',
    other: '📦 Outros'
  };
  return labels[category] || category;
}
