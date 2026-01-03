import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

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

// Function definitions for Gemini
const tools = [
  {
    function_declarations: [
      {
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
      },
      {
        name: "get_financial_summary",
        description: "Retorna um resumo financeiro do usuário incluindo saldo, ganhos e gastos do mês atual.",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "get_current_balance",
        description: "Retorna apenas o saldo atual do usuário.",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    ]
  }
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY não configurada');
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
- Alimentação/comida/restaurante/pizza/lanche → food
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

    // First call to Gemini with function calling
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: systemPrompt + "\n\nMensagem do usuário: " + message }]
            }
          ],
          tools: tools,
          tool_config: {
            function_calling_config: {
              mode: "AUTO"
            }
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Gemini response:', JSON.stringify(data, null, 2));

    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('No response from Gemini');
    }

    const parts = candidate.content?.parts || [];
    
    // Check for function calls
    const functionCall = parts.find((p: any) => p.functionCall);
    
    if (functionCall) {
      const { name, args } = functionCall.functionCall;
      console.log('Function call detected:', name, args);

      let functionResponse: any = {};
      let assistantMessage = '';

      switch (name) {
        case 'record_transaction':
          functionResponse = {
            success: true,
            transaction: args,
            message: `Transação registrada: ${args.type === 'expense' ? 'Gasto' : 'Ganho'} de R$ ${args.amount.toFixed(2)} em ${args.description}`
          };
          
          const typeLabel = args.type === 'expense' ? '💸 Gasto' : '💰 Ganho';
          assistantMessage = `${typeLabel} registrado com sucesso!\n\n📝 **${args.description}**\n💵 Valor: R$ ${args.amount.toFixed(2)}\n📂 Categoria: ${getCategoryLabel(args.category)}\n\nSeu novo saldo será atualizado automaticamente. Precisa de mais alguma coisa?`;
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
          
          assistantMessage = `📊 **Seu Resumo Financeiro**\n\n💰 Saldo atual: **R$ ${context.balance.toFixed(2)}**\n📈 Total de ganhos: R$ ${context.totalIncome.toFixed(2)}\n📉 Total de gastos: R$ ${context.totalExpense.toFixed(2)}\n💎 Taxa de economia: ${savingsRate}%\n\n${Number(savingsRate) >= 20 ? '🎉 Parabéns! Você está economizando bem!' : '💡 Dica: Tente economizar pelo menos 20% da sua renda.'}`;
          break;

        case 'get_current_balance':
          functionResponse = { balance: context.balance };
          assistantMessage = `💰 Seu saldo atual é **R$ ${context.balance.toFixed(2)}**.\n\nPrecisa de mais alguma informação?`;
          break;

        default:
          assistantMessage = 'Desculpe, não entendi o que você precisa. Pode reformular?';
      }

      return new Response(
        JSON.stringify({
          message: assistantMessage,
          functionCall: { name, args },
          functionResponse
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No function call, return text response
    const textPart = parts.find((p: any) => p.text);
    const textResponse = textPart?.text || 'Desculpe, não consegui processar sua mensagem.';

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
