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
    recentTransactions: Array<{
      amount: number;
      type: string;
      category: string;
      description: string;
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
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY não configurada');
    }

    const { message, context }: RequestBody = await req.json();
    console.log('Received message:', message);
    console.log('Context:', context);

    // Detect if user is talking about a transaction
    const transactionKeywords = /gastei|gasto|comprei|paguei|pagar|recebi|ganhei|entrou|gastando|compra|despesa|renda|salário|freelance|receita|custa|custou|investi/i;
    const isTransactionRequest = transactionKeywords.test(message);

    const systemPrompt = `Você é o "TIO DA GRANA" - um assistente financeiro BRUTALMENTE HONESTO, engraçado e sem papas na língua. Você é aquele tio chato que fala a verdade na cara, mas de um jeito que faz rir e refletir.

PERSONALIDADE OBRIGATÓRIA:
- Seja RÍGIDO e CRÍTICO com gastos desnecessários
- Use humor ácido, sarcasmo e ironia para fazer a pessoa pensar duas vezes
- Faça comparações absurdas ("Com isso comprava 50 pães de queijo!")
- Comemore economias e investimentos com empolgação exagerada
- Use expressões brasileiras, gírias e memes
- Seja CURTO e DIRETO - máximo 2 frases!

REGRAS CRÍTICAS:
- SEMPRE que o usuário mencionar um GASTO (gastei, comprei, paguei, etc) com valor, USE A FUNÇÃO record_transaction com type="expense"
- SEMPRE que o usuário mencionar uma RECEITA (recebi, ganhei, entrou dinheiro, etc) com valor, USE A FUNÇÃO record_transaction com type="income"
- NÃO responda com texto simples quando há um valor monetário mencionado - USE A FUNÇÃO!
- Se não entender o valor ou a descrição, PERGUNTE de forma engraçada

CONTEXTO FINANCEIRO ATUAL:
- Saldo: R$ ${context.balance.toFixed(2)}
- Receitas: R$ ${context.totalIncome.toFixed(2)}
- Gastos: R$ ${context.totalExpense.toFixed(2)}
- Economia: ${context.totalIncome > 0 ? ((context.totalIncome - context.totalExpense) / context.totalIncome * 100).toFixed(0) : 0}%

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

    // Force tool use when transaction keywords are detected
    const toolChoice = isTransactionRequest 
      ? { type: "function", function: { name: "record_transaction" } }
      : 'auto';

    console.log('Transaction request detected:', isTransactionRequest, 'Tool choice:', toolChoice);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.dev',
        'X-Title': 'TioDaGrana Finance'
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
          functionResponse = {
            balance: context.balance,
            totalIncome: context.totalIncome,
            totalExpense: context.totalExpense
          };
          
          const savingsRate = context.totalIncome > 0 
            ? ((context.totalIncome - context.totalExpense) / context.totalIncome * 100)
            : 0;
          
          if (savingsRate >= 30) {
            responseMessage = `📊 Saldo: R$ ${context.balance.toFixed(2)} | Ganhou R$ ${context.totalIncome.toFixed(2)} | Gastou R$ ${context.totalExpense.toFixed(2)}\n\n🏆 ${savingsRate.toFixed(0)}% de economia! Tá voando, hein? Continua assim! 🚀`;
          } else if (savingsRate >= 10) {
            responseMessage = `📊 Saldo: R$ ${context.balance.toFixed(2)} | Ganhou R$ ${context.totalIncome.toFixed(2)} | Gastou R$ ${context.totalExpense.toFixed(2)}\n\n😐 ${savingsRate.toFixed(0)}% de economia... Medíocre! Dá pra melhorar, bora cortar gastos! 💪`;
          } else {
            responseMessage = `📊 Saldo: R$ ${context.balance.toFixed(2)} | Ganhou R$ ${context.totalIncome.toFixed(2)} | Gastou R$ ${context.totalExpense.toFixed(2)}\n\n🚨 ${savingsRate.toFixed(0)}% de economia?! Tá de brincadeira! Você gasta quase TUDO que ganha! 😱`;
          }
          break;

        case 'get_current_balance':
          functionResponse = { balance: context.balance };
          
          if (context.balance > 1000) {
            responseMessage = `💰 Saldo: R$ ${context.balance.toFixed(2)}. Tá bem! Mas não é pra sair gastando, viu? Guarda isso! 😏`;
          } else if (context.balance > 100) {
            responseMessage = `💰 Saldo: R$ ${context.balance.toFixed(2)}. Apertado hein? Segura a onda e para de gastar! 🤔`;
          } else if (context.balance > 0) {
            responseMessage = `💰 Saldo: R$ ${context.balance.toFixed(2)}. Quase no vermelho! Para TUDO e só gasta o essencial! 😰`;
          } else {
            responseMessage = `🚨 Saldo: R$ ${context.balance.toFixed(2)}. NEGATIVO?! Para tudo e repensa sua vida financeira AGORA! 😭`;
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
