import { Product } from "../../model/product";
import { ProductStore } from "../product-store";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandOutput,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

export class DynamoDbStore implements ProductStore {
  private static tableName = process.env.TABLE_NAME;
  private static ddbClient = new DynamoDBClient({});
  private static ddbDocClient = DynamoDBDocumentClient.from(DynamoDbStore.ddbClient);

  async getProduct(id: string): Promise<Product | undefined> {
    const params = new GetCommand({
      TableName: DynamoDbStore.tableName,
      Key: { id },
    });
    const result: GetCommandOutput = await DynamoDbStore.ddbDocClient.send(params);
    return result.Item as Product | undefined;
  }

  async putProduct(product: Product): Promise<void> {
    const params = new PutCommand({
      TableName: DynamoDbStore.tableName,
      Item: {
        id: product.id,
        name: product.name,
        price: product.price,
      },
    });
    await DynamoDbStore.ddbDocClient.send(params);
  }

  async deleteProduct(id: string): Promise<void> {
    const params = new DeleteCommand({
      TableName: DynamoDbStore.tableName,
      Key: { id },
    });
    await DynamoDbStore.ddbDocClient.send(params);
  }

  async getProducts(): Promise<Product[]> {
    const params = new ScanCommand({
      TableName: DynamoDbStore.tableName,
      Limit: 20,
    });
    const result = await DynamoDbStore.ddbDocClient.send(params);
    return (result.Items as Product[]) ?? [];
  }
}
