import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class SearchService {
  private logger = new Logger(SearchService.name);

  constructor(private es: ElasticsearchService) {
    this.initializeIndices();
  }

  private async initializeIndices() {
    const indices = {
      messages: {
        mappings: {
          properties: {
            chatId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            content: { type: 'text', analyzer: 'standard' },
            contentType: { type: 'keyword' },
            createdAt: { type: 'date' },
            embedding: { type: 'dense_vector', dims: 768 },
          }
        }
      },
      users: {
        mappings: {
          properties: {
            username: { type: 'keyword' },
            displayName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            bio: { type: 'text' },
          }
        }
      },
      groups: {
        mappings: {
          properties: {
            name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            description: { type: 'text' },
            memberCount: { type: 'integer' },
          }
        }
      }
    };

    for (const [name, config] of Object.entries(indices)) {
      const exists = await this.es.indices.exists({ index: `nexus_${name}` });
      if (!exists) {
        await this.es.indices.create({ index: `nexus_${name}`, ...config });
      }
    }
  }

  async indexMessage(message: any) {
    return this.es.index({
      index: 'nexus_messages',
      id: message.id,
      body: message,
    });
  }

  async indexUser(user: any) {
    return this.es.index({
      index: 'nexus_users',
      id: user.id,
      body: user,
    });
  }

  async searchMessages(query: string, chatId?: string, limit = 50) {
    const must: any[] = [{ multi_match: { query, fields: ['content^2', 'contentType'] } }];
    if (chatId) must.push({ term: { chatId } });

    const result = await this.es.search({
      index: 'nexus_messages',
      body: { query: { bool: { must } }, size: limit, sort: [{ createdAt: 'desc' }] },
    });

    return result.hits.hits.map(h => ({ id: h._id, ...(h._source as any) }));
  }

  async searchUsers(query: string, limit = 30) {
    const result = await this.es.search({
      index: 'nexus_users',
      body: {
        query: {
          multi_match: { query, fields: ['username^3', 'displayName^2', 'bio'], fuzziness: 'AUTO' }
        },
        size: limit,
      },
    });
    return result.hits.hits.map(h => ({ id: h._id, ...(h._source as any) }));
  }

  async searchGroups(query: string, limit = 30) {
    const result = await this.es.search({
      index: 'nexus_groups',
      body: { query: { match: { name: { query, fuzziness: 'AUTO' } } }, size: limit },
    });
    return result.hits.hits.map(h => ({ id: h._id, ...(h._source as any) }));
  }

  async semanticSearch(embedding: number[], index: string, limit = 20) {
    const result = await this.es.search({
      index,
      body: {
        query: {
          script_score: {
            query: { match_all: {} },
            script: {
              source: "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
              params: { query_vector: embedding },
            },
          },
        },
        size: limit,
      },
    });
    return result.hits.hits.map(h => ({ id: h._id, score: h._score, ...(h._source as any) }));
  }
}