// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract Groth16VerifierModeB {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 3201047011405089787566705160899974898622253304651383415847519393909613629864;
    uint256 constant alphay  = 19991967635804575665121056377572116964450636331157867528204173403342387050582;
    uint256 constant betax1  = 11852813170183882811698017681345785012980045393622798330003429557398341449404;
    uint256 constant betax2  = 176204320968851127278464722608807444229936232260044574926608879611616592041;
    uint256 constant betay1  = 1565470377212769244903764995923420929482433266740021658361912795640208028274;
    uint256 constant betay2  = 14187114218607160263071961086435851215317800661030358191014968634688013444454;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 8952934939021353762045114332614508444396807397690751674258460813357839258888;
    uint256 constant deltax2 = 21017782177630925696535094850191411309829048144665284092654427921377241580455;
    uint256 constant deltay1 = 3109727547331146455121240434615186105007622027638498590803840498333460505027;
    uint256 constant deltay2 = 5187500300975536145714557633017996284638530314832461327381356322441702033715;

    
    uint256 constant IC0x = 19784893590834837519661650573458677399736381770631849362188539144329963392760;
    uint256 constant IC0y = 4247113942672892681107906880830639949674575723712981837644506397595884304320;
    
    uint256 constant IC1x = 1098620138098241231852856295583804201770948606271597483661789267302838525618;
    uint256 constant IC1y = 2937203736808746560028324895562949896502995249963543552756224829350810924586;
    
    uint256 constant IC2x = 6966781093830691846119003481771497263623417716323534388667117380323027725179;
    uint256 constant IC2y = 2719325930415011555689285995396839956169772587703143717864470703552040919175;
    
    uint256 constant IC3x = 12514370549669683573078463348417711851015291276111966986425789090865876683154;
    uint256 constant IC3y = 9778371392308662484868258079552374329258467742496345697387601151057527869;
    
    uint256 constant IC4x = 8945180669706458342867075016330875709895257327151765195215575997855419411079;
    uint256 constant IC4y = 4218460361494266140402391487118850249420207744805039918639154997498201227624;
    
    uint256 constant IC5x = 4141624968220042927780786406143712074324921646065955355335300535861074770479;
    uint256 constant IC5y = 17011626216515724863359705342399181722611338096078177463641404470319494974751;
    
    uint256 constant IC6x = 18925894305397734612505512050993105056109016993422503385722625216383547962202;
    uint256 constant IC6y = 2261708652189130896221402337638861284584913041890122382419272726316653782693;
    
    uint256 constant IC7x = 15310530248293412399226463446897071103895432476996067685792098464841500210730;
    uint256 constant IC7y = 12027020451167315109257387655168804423235774739794873146741779200768891126913;
    
    uint256 constant IC8x = 20627480398206199531828320538708048481335813341773453222824705540957669806267;
    uint256 constant IC8y = 3842822658206395364896722605275629391794746366986672539660347213386735974590;
    
    uint256 constant IC9x = 18890123724639788172262576835049546203238216941408998555820339950557559049586;
    uint256 constant IC9y = 9614535521358148573921030426189949441491170451148140755685335754073051722818;
    
    uint256 constant IC10x = 12484839243100048708959396247942751117960296176271499062802218236722687853776;
    uint256 constant IC10y = 3689716082300253516257154278387104896518109745298056489079381115027257448115;
    
    uint256 constant IC11x = 19948342425982802889018233379912548492740840276195749102868897040957160701926;
    uint256 constant IC11y = 21140963714259187082075033715648998668986648456587916954504375877479207712936;
    
    uint256 constant IC12x = 15769474517861697622599160726045627976506771958616724248909155646531715067011;
    uint256 constant IC12y = 15655824710039933114584208813118026637507202772813668956050091530681864604649;
    
    uint256 constant IC13x = 4886419082296869561219910176238863109980108897675884837696832557456067389971;
    uint256 constant IC13y = 14885228144488112540989265554201657765482877018297879520827262488973145005539;
    
    uint256 constant IC14x = 12903832148851672937539242903813610677594346484434775149448144612683620708107;
    uint256 constant IC14y = 6094518893940323281938325375777295614450148936976322038486393335107679716803;
    
    uint256 constant IC15x = 7399313973363962177422133787572729525443763891570091538002922639223789303092;
    uint256 constant IC15y = 20108744680677155230352543388433851119643814990725132499634298625698396471249;
    
    uint256 constant IC16x = 16414836994330802145100906646638655149852975739677207642787414825823029348116;
    uint256 constant IC16y = 17137837030261960832966809650767157757066183367004345433639164738336346982299;
    
    uint256 constant IC17x = 10375616501377911954889447003451290206780180860336894727563998869428075431619;
    uint256 constant IC17y = 9544244878982777120558512679768485736700120787326290691234740381515272229570;
    
    uint256 constant IC18x = 21122742523725041352328769687681508798155373206647683206077647739121257411170;
    uint256 constant IC18y = 1615668643661111381493481954683707342985092733352188296533373151429730006594;
    
    uint256 constant IC19x = 15537962974011620208541554698574184194792681301109450625966214551377565698708;
    uint256 constant IC19y = 17059232275248107758383827217918552341519133724024146609599399664998969006580;
    
    uint256 constant IC20x = 5383071333603593695851522083803319149030235260366156055966003135336628878403;
    uint256 constant IC20y = 13914872544134817958459659361034524717036521246300721321730241910149872009177;
    
    uint256 constant IC21x = 20617540889355725488308006759121744784990099596786475894778047867475699628905;
    uint256 constant IC21y = 7785771367325317604673227669476438170744662608745695629837818360460546522043;
    
    uint256 constant IC22x = 4762623530250783153764587599720660715096079534936724163418742836299892827374;
    uint256 constant IC22y = 1316550001327587685686976338124537777968530977336430867970756322660852883423;
    
    uint256 constant IC23x = 662193140680605672225604648802874416449352334148982803393283226824542010382;
    uint256 constant IC23y = 7938450613237044240078729285795750558658118911937519643988780059820429129397;
    
    uint256 constant IC24x = 646100772762471361663357847617109751538408501821039365025562416109422226606;
    uint256 constant IC24y = 14141872204098478544156412571550049555680699923194184388638039929662218158976;
    
    uint256 constant IC25x = 10293537622503026795518559790961001640648261320514385268786587374529552886625;
    uint256 constant IC25y = 18896260231020195942271965685186855125510105176472105888492028658935143286121;
    
    uint256 constant IC26x = 8040918891964750193153930604918920181898654524924615021283444777516633533466;
    uint256 constant IC26y = 7035243377653158501216735456592893162985239261685502167347001087000010332092;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[26] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                
                g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))
                
                g1_mulAccC(_pVk, IC12x, IC12y, calldataload(add(pubSignals, 352)))
                
                g1_mulAccC(_pVk, IC13x, IC13y, calldataload(add(pubSignals, 384)))
                
                g1_mulAccC(_pVk, IC14x, IC14y, calldataload(add(pubSignals, 416)))
                
                g1_mulAccC(_pVk, IC15x, IC15y, calldataload(add(pubSignals, 448)))
                
                g1_mulAccC(_pVk, IC16x, IC16y, calldataload(add(pubSignals, 480)))
                
                g1_mulAccC(_pVk, IC17x, IC17y, calldataload(add(pubSignals, 512)))
                
                g1_mulAccC(_pVk, IC18x, IC18y, calldataload(add(pubSignals, 544)))
                
                g1_mulAccC(_pVk, IC19x, IC19y, calldataload(add(pubSignals, 576)))
                
                g1_mulAccC(_pVk, IC20x, IC20y, calldataload(add(pubSignals, 608)))
                
                g1_mulAccC(_pVk, IC21x, IC21y, calldataload(add(pubSignals, 640)))
                
                g1_mulAccC(_pVk, IC22x, IC22y, calldataload(add(pubSignals, 672)))
                
                g1_mulAccC(_pVk, IC23x, IC23y, calldataload(add(pubSignals, 704)))
                
                g1_mulAccC(_pVk, IC24x, IC24y, calldataload(add(pubSignals, 736)))
                
                g1_mulAccC(_pVk, IC25x, IC25y, calldataload(add(pubSignals, 768)))
                
                g1_mulAccC(_pVk, IC26x, IC26y, calldataload(add(pubSignals, 800)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            
            checkField(calldataload(add(_pubSignals, 288)))
            
            checkField(calldataload(add(_pubSignals, 320)))
            
            checkField(calldataload(add(_pubSignals, 352)))
            
            checkField(calldataload(add(_pubSignals, 384)))
            
            checkField(calldataload(add(_pubSignals, 416)))
            
            checkField(calldataload(add(_pubSignals, 448)))
            
            checkField(calldataload(add(_pubSignals, 480)))
            
            checkField(calldataload(add(_pubSignals, 512)))
            
            checkField(calldataload(add(_pubSignals, 544)))
            
            checkField(calldataload(add(_pubSignals, 576)))
            
            checkField(calldataload(add(_pubSignals, 608)))
            
            checkField(calldataload(add(_pubSignals, 640)))
            
            checkField(calldataload(add(_pubSignals, 672)))
            
            checkField(calldataload(add(_pubSignals, 704)))
            
            checkField(calldataload(add(_pubSignals, 736)))
            
            checkField(calldataload(add(_pubSignals, 768)))
            
            checkField(calldataload(add(_pubSignals, 800)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
