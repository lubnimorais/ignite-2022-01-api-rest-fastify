import { FastifyInstance } from 'fastify';

import { randomUUID } from 'node:crypto';

import { knex } from '../database';

import { z } from 'zod';

import { checkSessionIdExists } from '../middlewares/check-session-id-exists';

export async function transactionsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request, reply) => {
    console.log(`${request.method} - ${request.url}`);
  });

  app.post('/', async (request, reply) => {
    const createTransactionBodySchema = z.object({
      title: z.string(),
      amount: z.number(),
      type: z.enum(['credit', 'debit']),
    });

    const { title, amount, type } = createTransactionBodySchema.parse(
      request.body,
    );

    // PEGANDO O COOKIE SE ELE EXISTIR
    let sessionId = request.cookies.sessionId;

    if (!sessionId) {
      sessionId = randomUUID();

      // PARA SALVAR NO COOKIE UMA INFORMAÇÃO, UTILIZAMOS O REPLY (RESPONSE)
      reply.cookie('sessionId', sessionId, {
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      });
    }

    const transaction = await knex('transactions')
      .insert({
        id: randomUUID(),
        title,
        amount: type === 'credit' ? amount * 100 : amount * 100 * -1,
        session_id: sessionId,
      })
      .returning('*');

    return reply.status(201).send({ transaction: transaction[0] });
  });

  // LISTAR TODAS TRANSACTIONS
  app.get(
    '/',
    {
      preHandler: [checkSessionIdExists],
    },
    async (request, reply) => {
      const { sessionId } = request.cookies;

      const transactions = await knex('transactions')
        .where('session_id', sessionId)
        .select();

      // PODE SER RETORNADO DESSAS DUAS FORMAS

      return reply.status(200).send({ transactions });

      // return { transactions };
    },
  );

  app.get(
    '/:id',
    {
      preHandler: [checkSessionIdExists],
    },
    async (request, reply) => {
      const { sessionId } = request.cookies;

      const getTransactionParamSchema = z.object({
        id: z.string().uuid(),
      });

      const { id } = getTransactionParamSchema.parse(request.params);

      const transaction = await knex('transactions')
        .where({ id, session_id: sessionId })
        .first();

      return reply.status(200).send({ transaction });
      // return { transaction };
    },
  );

  app.get(
    '/summary',
    {
      preHandler: [checkSessionIdExists],
    },
    async (request, reply) => {
      const { sessionId } = request.cookies;

      const summary = await knex('transactions')
        .where('session_id', sessionId)
        .sum('amount', { as: 'amount' })
        .first();

      return reply.status(200).send({ summary });
    },
  );
}
