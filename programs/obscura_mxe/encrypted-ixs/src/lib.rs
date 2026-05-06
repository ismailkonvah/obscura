use arcis::*;

#[encrypted]
mod circuits {
    use arcis::*;

    pub struct BidInputs {
        amount_0: u64,
        amount_1: u64,
        amount_2: u64,
        bidder_0: u128,
        bidder_1: u128,
        bidder_2: u128,
    }

    pub struct AuctionResult {
        winner_commitment: u128,
        clearing_price_lamports: u64,
        second_price_lamports: u64,
        bid_count: u8,
    }

    #[instruction]
    pub fn resolve_blind_auction(
        bid_inputs_ctxt: Enc<Shared, BidInputs>,
        format: u8,
    ) -> AuctionResult {
        let bids = bid_inputs_ctxt.to_arcis();

        let mut highest_amount = bids.amount_0;
        let mut highest_bidder = bids.bidder_0;
        let mut second_amount: u64 = 0;
        let mut bid_count: u8 = 0;

        if bids.amount_0 > 0 {
            bid_count = bid_count + 1;
        }

        if bids.amount_1 > 0 {
            bid_count = bid_count + 1;
            if bids.amount_1 > highest_amount {
                second_amount = highest_amount;
                highest_amount = bids.amount_1;
                highest_bidder = bids.bidder_1;
            } else if bids.amount_1 > second_amount {
                second_amount = bids.amount_1;
            }
        }

        if bids.amount_2 > 0 {
            bid_count = bid_count + 1;
            if bids.amount_2 > highest_amount {
                second_amount = highest_amount;
                highest_amount = bids.amount_2;
                highest_bidder = bids.bidder_2;
            } else if bids.amount_2 > second_amount {
                second_amount = bids.amount_2;
            }
        }

        let mut clearing_price = highest_amount;
        if format == 1 && second_amount > 0 {
            clearing_price = second_amount;
        }

        AuctionResult {
            winner_commitment: highest_bidder.reveal(),
            clearing_price_lamports: clearing_price.reveal(),
            second_price_lamports: second_amount.reveal(),
            bid_count: bid_count.reveal(),
        }
    }
}
