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
            enum: ["food", "transport", "entertainment", "shopping", "health", "education", "bills", "salary", "freelance", "investment", "gift", "other"],
            description: "Categoria da transação"
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
    
    const systemPrompt = `Você é o "TIO DA GRANA" - um assistente financeiro BRUTALMENTE HONESTO, engraçado e sem papas na língua. Você é aquele tio chato que fala a verdade na cara, mas de um jeito que faz rir e refletir.

PERSONALIDADE OBRIGATÓRIA:
- Seja RÍGIDO e CRÍTICO com gastos desnecessários
- Use humor ácido, sarcasmo e ironia para fazer a pessoa pensar duas vezes
- Faça comparações absurdas ("Com isso comprava 50 pães de queijo!")
- Comemore economias e investimentos com empolgação exagerada
- Use expressões brasileiras, gírias e memes
- Seja CURTO e DIRETO - máximo 3 frases!

REGRAS CRÍTICAS:
- SEMPRE que o usuário mencionar um GASTO (gastei, comprei, paguei, etc) com valor, USE A FUNÇÃO record_transaction com type="expense"
- SEMPRE que o usuário mencionar uma RECEITA (recebi, ganhei, entrou dinheiro, etc) com valor, USE A FUNÇÃO record_transaction com type="income"
- Quando perguntarem SALDO, LIMITE, CRÉDITO use get_current_balance
- Quando perguntarem resumo financeiro, quanto gastou/recebeu no mês use get_financial_summary
- Quando perguntarem quanto gastou/recebeu HOJE ou em um DIA específico use get_day_transactions
- Quando perguntarem sobre PAGAMENTOS AGENDADOS ou quanto vai pagar no dia X use get_scheduled_payments
- NÃO responda com texto simples quando há um valor monetário para registrar - USE A FUNÇÃO!
- Se não entender o valor ou a descrição, PERGUNTE de forma engraçada

CONTEXTO FINANCEIRO ATUAL:
- Saldo Débito: R$ ${context.balance.toFixed(2)}
- Receitas do Mês: R$ ${context.totalIncome.toFixed(2)}
- Gastos do Mês: R$ ${context.totalExpense.toFixed(2)}
- Economia: ${context.totalIncome > 0 ? ((context.totalIncome - context.totalExpense) / context.totalIncome * 100).toFixed(0) : 0}%
- Limite de Crédito Total: R$ ${(context.creditLimit || 0).toFixed(2)}
- Crédito Usado: R$ ${(context.creditUsed || 0).toFixed(2)}
- Crédito Disponível: R$ ${creditAvailable.toFixed(2)}
- Dia de Vencimento da Fatura: ${context.creditDueDay || 5}
- Dias até o Vencimento: ${context.daysUntilDue || 0} dias
- Salário: R$ ${(context.salaryAmount || 0).toFixed(2)} (dia ${context.salaryDay || 5})
- Total Pagamentos do Mês: R$ ${(context.monthlyPaymentsTotal || 0).toFixed(2)}
- Saldo Previsto fim do Mês: R$ ${(context.projectedBalance || 0).toFixed(2)}
- Gastos Hoje: R$ ${(context.todayExpenses || 0).toFixed(2)}
- Receitas Hoje: R$ ${(context.todayIncome || 0).toFixed(2)}

PAGAMENTOS AGENDADOS:
${scheduledPaymentsInfo}

CATEGORIAS (escolha a mais apropriada):
- food = alimentação, comida, restaurante, pizza, lanche, almoço, jantar, café
- transport = uber, gasolina, ônibus, passagem, 99, táxi
- entertainment = lazer, cinema, jogos, streaming, festa, bar
- shopping = compras, roupa, loja, tênis, celular
- health = farmácia, médico, remédio, academia
- education = curso, livro, escola, faculdade
- bills = luz, água, internet, aluguel, conta
- salary = salário (renda)
- freelance = trabalho extra (renda)
- investment = investimento (renda ou gasto)
- gift = presente (renda ou gasto)
- other = outros

RESPONDA SEMPRE EM PORTUGUÊS BRASILEIRO, SEJA ENGRAÇADO E RÍGIDO!`;

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
            const jokes = [
              `💸 Lá se vão R$ ${args.amount.toFixed(2)}... Com isso dava pra comprar ${Math.floor(args.amount / 0.50)} balas Juquinha! Anotado, gastador! 😤`,
              `💸 R$ ${args.amount.toFixed(2)} a menos! Seu eu do futuro tá chorando agora. Registrei aqui... 😒`,
              `💸 Gastou R$ ${args.amount.toFixed(2)} com ${args.description}? Dinheiro na sua mão é igual água: escorre! 🏃💨`,
              `💸 Pronto, anotei R$ ${args.amount.toFixed(2)}. Isso eram ${Math.floor(args.amount / 5)} cafézinhos! Pensa nisso! ☕`,
              `💸 R$ ${args.amount.toFixed(2)} em ${args.description}? Tá pensando que é herdeiro? Registrado! 🙄`
            ];
            responseMessage = jokes[Math.floor(Math.random() * jokes.length)];
          } else {
            const celebrations = [
              `💰 AEEEE! R$ ${args.amount.toFixed(2)} entrando! Agora me conta: vai guardar quanto ou vai torrar tudo? 🤑`,
              `💰 R$ ${args.amount.toFixed(2)} na conta! Tá rico! Mas calma lá, não sai gastando não! 💪`,
              `💰 Entrou R$ ${args.amount.toFixed(2)}! Bora investir pelo menos 20%? Ou vai fazer besteira? 📈`,
              `💰 Recebeu R$ ${args.amount.toFixed(2)}! Dinheiro na mão é vendaval, hein? Segura esse baguio! 🌪️`
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
          functionResponse = { 
            balance: context.balance,
            creditLimit: context.creditLimit,
            creditUsed: context.creditUsed,
            creditAvailable: creditAvail
          };
          
          responseMessage = `💰 Saldo Débito: R$ ${context.balance.toFixed(2)}
💳 Crédito: R$ ${creditAvail.toFixed(2)} disponível de R$ ${(context.creditLimit || 0).toFixed(2)}
📅 Fatura vence dia ${context.creditDueDay} (${context.daysUntilDue} dias)`;
          
          if (context.balance < 100) {
            responseMessage += `\n\n🚨 Atenção: saldo baixo! Controla os gastos! 😰`;
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
