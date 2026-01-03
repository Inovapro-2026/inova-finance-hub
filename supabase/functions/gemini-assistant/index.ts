import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

interface RequestBody {
  message: string;
  context: {
    balance: number;
    totalIncome: number;
    totalExpense: number;
    recentTransactions: Array<{
      amount: number;
      type: string;
      category: string;
      description: string;
    }>;
  };
}

// Tool definitions for OpenAI-compatible API
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
      description: "Retorna um resumo financeiro do usuário incluindo saldo, ganhos e gastos do mês atual.",
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
      description: "Retorna apenas o saldo atual do usuário.",
      parameters: {
        type: "object",
        properties: {},
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
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const { message, context }: RequestBody = await req.json();
    console.log('Received message:', message);
    console.log('Context:', context);

    const systemPrompt = `Você é a assistente financeira do INOVAFINANCE, um app de controle financeiro premium. Seu nome é NOVA.

PERSONALIDADE:
- Amigável, profissional e empática
- Use emojis moderadamente para tornar a conversa agradável
- Dê dicas financeiras personalizadas quando apropriado
- Sempre confirme ações importantes antes de executar

CONTEXTO FINANCEIRO ATUAL DO USUÁRIO:
- Saldo atual: R$ ${context.balance.toFixed(2)}
- Total de ganhos: R$ ${context.totalIncome.toFixed(2)}
- Total de gastos: R$ ${context.totalExpense.toFixed(2)}

CAPACIDADES:
1. REGISTRAR TRANSAÇÕES: Quando o usuário disser algo como "gastei 50 com pizza", "comprei algo por 100", "recebi 500 de salário", extraia as informações e use a função record_transaction.
2. CONSULTAR SALDO: Responda sobre o saldo atual quando perguntado.
3. RESUMO FINANCEIRO: Forneça análises e resumos quando solicitado.
4. DICAS: Ofereça sugestões personalizadas baseadas nos gastos.

MAPEAMENTO DE CATEGORIAS:
- Alimentação/comida/restaurante/pizza/lanche/almoço/jantar/café → food
- Transporte/uber/gasolina/ônibus → transport
- Lazer/cinema/diversão/jogos → entertainment
- Compras/roupa/sapato/loja → shopping
- Saúde/farmácia/médico → health
- Educação/curso/livro → education
- Contas/luz/água/internet → bills
- Salário/pagamento → salary
- Freelance/extra → freelance
- Investimento/rendimento → investment
- Presente/gift → gift
- Outros → other

Responda sempre em português brasileiro de forma natural e concisa.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        tools: tools,
        tool_choice: 'auto'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded',
            message: 'Muitas requisições. Por favor, aguarde alguns segundos e tente novamente.'
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: 'Payment required',
            message: 'Limite de uso atingido. Entre em contato com o suporte.'
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response:', JSON.stringify(data, null, 2));

    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('No response from AI');
    }

    const assistantMessage = choice.message;
    
    // Check for tool calls
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
            message: `Transação registrada: ${args.type === 'expense' ? 'Gasto' : 'Ganho'} de R$ ${args.amount.toFixed(2)} em ${args.description}`
          };
          
          const typeLabel = args.type === 'expense' ? '💸 Gasto' : '💰 Ganho';
          responseMessage = `${typeLabel} registrado com sucesso!\n\n📝 **${args.description}**\n💵 Valor: R$ ${args.amount.toFixed(2)}\n📂 Categoria: ${getCategoryLabel(args.category)}\n\nSeu novo saldo será atualizado automaticamente. Precisa de mais alguma coisa?`;
          break;

        case 'get_financial_summary':
          functionResponse = {
            balance: context.balance,
            totalIncome: context.totalIncome,
            totalExpense: context.totalExpense
          };
          
          const savingsRate = context.totalIncome > 0 
            ? ((context.totalIncome - context.totalExpense) / context.totalIncome * 100).toFixed(1)
            : 0;
          
          responseMessage = `📊 **Seu Resumo Financeiro**\n\n💰 Saldo atual: **R$ ${context.balance.toFixed(2)}**\n📈 Total de ganhos: R$ ${context.totalIncome.toFixed(2)}\n📉 Total de gastos: R$ ${context.totalExpense.toFixed(2)}\n💎 Taxa de economia: ${savingsRate}%\n\n${Number(savingsRate) >= 20 ? '🎉 Parabéns! Você está economizando bem!' : '💡 Dica: Tente economizar pelo menos 20% da sua renda.'}`;
          break;

        case 'get_current_balance':
          functionResponse = { balance: context.balance };
          responseMessage = `💰 Seu saldo atual é **R$ ${context.balance.toFixed(2)}**.\n\nPrecisa de mais alguma informação?`;
          break;

        default:
          responseMessage = 'Desculpe, não entendi o que você precisa. Pode reformular?';
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

    // No tool call, return text response
    const textResponse = assistantMessage.content || 'Desculpe, não consegui processar sua mensagem.';

    return new Response(
      JSON.stringify({ message: textResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in gemini-assistant:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        message: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.'
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
