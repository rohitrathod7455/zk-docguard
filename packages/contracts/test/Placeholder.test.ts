import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Placeholder } from '../typechain-types';

describe('Placeholder', function () {
  it('should return the correct version', async function () {
    const PlaceholderFactory = await ethers.getContractFactory('Placeholder');
    const placeholder = (await PlaceholderFactory.deploy()) as unknown as Placeholder;
    await placeholder.waitForDeployment();

    expect(await placeholder.VERSION()).to.equal('0.1.0');
  });
});
