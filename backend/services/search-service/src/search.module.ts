import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [
    ElasticsearchModule.register({
      node: process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200',
      maxRetries: 3,
      requestTimeout: 10000,
    }),
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}