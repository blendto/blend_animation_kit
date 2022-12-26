import { inject, injectable } from "inversify";
import { IService } from "./index";
import { TYPES } from "../types";
import { Repo } from "../repositories/base";
import { NonHeroRecipeListEntity } from "../repositories/nonHeroRecipeList";
import { EncodedPageKey } from "../helpers/paginationUtils";
import UserError from "../base/errors/UserError";

type NonHeroRecipeListPage = {
  recipeLists: NonHeroRecipeListEntity[];
  nextPageKey: string;
};
const PAGE_SIZE = 15;

@injectable()
export class NonHeroRecipeListService implements IService {
  @inject(TYPES.NonHeroRecipeListRepo) repo: Repo<NonHeroRecipeListEntity>;

  async getRecipeListPage(pageKey: string): Promise<NonHeroRecipeListPage> {
    const encodedPageKey = new EncodedPageKey(pageKey);
    if (encodedPageKey.exists() && !encodedPageKey.isValid()) {
      throw new UserError("pageKey should be a string");
    }
    const pageKeyObject = encodedPageKey.decode();

    const data = await this.repo.query(
      { isEnabled: 1 },
      { limit: PAGE_SIZE, startAt: pageKeyObject }
    );
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const nextPageKey = EncodedPageKey.fromObject(data.lastKey)?.key;
    return { recipeLists: data, nextPageKey };
  }

  async getAll(
    pageKey: string
  ): Promise<{ data: NonHeroRecipeListEntity[]; nextPageKey: string }> {
    const pageItems = { data: [], nextPageKey: pageKey };
    let fetched: NonHeroRecipeListPage;
    do {
      // eslint-disable-next-line no-await-in-loop
      fetched = await this.getRecipeListPage(pageItems.nextPageKey);
      pageItems.data.push(...fetched.recipeLists);
      pageItems.nextPageKey = fetched.nextPageKey;
    } while (pageItems.data.length < PAGE_SIZE && fetched.nextPageKey);
    return pageItems;
  }
}
