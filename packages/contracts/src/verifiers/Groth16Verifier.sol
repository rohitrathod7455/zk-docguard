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

contract Groth16Verifier {
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
    uint256 constant deltax1 = 8164696089014391337525702458658137865189389987080338065612828730701532958326;
    uint256 constant deltax2 = 17128539508171663302006251180074610577551571259253751456427078364803514873421;
    uint256 constant deltay1 = 19555719441329600510867980144557351445794430059695979531167438881143888811837;
    uint256 constant deltay2 = 17181639040951019659377153617633391319454812832571728474889303836975229731915;

    
    uint256 constant IC0x = 20027438680202944917848497876235661893580093572653303638314391365192671357464;
    uint256 constant IC0y = 15096844088033604241787439440117978377037396313767640202432664996517885961000;
    
    uint256 constant IC1x = 15551357314683331106513146224753354799807126413483842140783678721643404106874;
    uint256 constant IC1y = 14167233855821703160413210620165282089770965333113797531181536964902447792236;
    
    uint256 constant IC2x = 14040745465914578521773183300515554539420864830781944399047714402228589613716;
    uint256 constant IC2y = 20480455962465910706977518619779879026499002390127625586611971711400763401358;
    
    uint256 constant IC3x = 578579296825924489556745772467139508632010886485151418915699564740504980148;
    uint256 constant IC3y = 3609069594314652871233881443514040096614055035390341675039730558241121748537;
    
    uint256 constant IC4x = 4218500484656828135032342621140859900587739042151685301366633478068561818521;
    uint256 constant IC4y = 3566426432657901362296099052091241593398429075822981153551786851084562493880;
    
    uint256 constant IC5x = 5167991578812253465531909410376639470380060340768037202399960827821142384312;
    uint256 constant IC5y = 3874198153184061506897403123774800408480482042755071788207117280035224501165;
    
    uint256 constant IC6x = 607362146400733983154956941800357156601667265685558905112472653332197355636;
    uint256 constant IC6y = 1621172248340221582130530891609838679629262507515254576076678689083763056605;
    
    uint256 constant IC7x = 19982819290300964442129888786716887879908695776376119280477094729922658895131;
    uint256 constant IC7y = 14736536650611123035590669758486334439177652892815312851445344862392893450746;
    
    uint256 constant IC8x = 6405216777259059296001613871728014565003923198191516656505177436495894753447;
    uint256 constant IC8y = 14414992336832821851662425706639773498206151246187228626555563311950359661310;
    
    uint256 constant IC9x = 8705020740898972411761459469749629005285894122151660020243676103157932994044;
    uint256 constant IC9y = 500744453632277934001957828500843071990214082095503532792608532422570940242;
    
    uint256 constant IC10x = 12968485993884836446034146335129933843363842289978680696585231214702846661935;
    uint256 constant IC10y = 4084118591634070279038425648740045441136676151113059547043102840478781744462;
    
    uint256 constant IC11x = 12998603857502780022781550989369847388350405262286432889375723593273164082846;
    uint256 constant IC11y = 9587141343793006060708783302487442512772480792083208764239008729504724360360;
    
    uint256 constant IC12x = 12452601210514446704820070010145334272543512582950335537637559702032206255660;
    uint256 constant IC12y = 11214286996736143847756764973187747072532068703047805527348206907669845989081;
    
    uint256 constant IC13x = 8266418267340028392981979788204837417694817225862103988802777923673761864307;
    uint256 constant IC13y = 19854237258929794253065842302056261021195236466210226863111082029316728380212;
    
    uint256 constant IC14x = 2970143025163640574259814520210158020910921376338500982224280793921649596974;
    uint256 constant IC14y = 9567788958307218927605902117241825293262599990101077242266749704158583302457;
    
    uint256 constant IC15x = 256893942429411010217839364171026859424232635512086321270257198817017764573;
    uint256 constant IC15y = 12842987269838872367594911871989382366533588319094011692059840752986907145243;
    
    uint256 constant IC16x = 3791963015046827966457641478635213551468089418731516027800669462140993593117;
    uint256 constant IC16y = 12938253698568942472026963516304462325697818226233016682497534619721146608410;
    
    uint256 constant IC17x = 12357689233436097740098792253077992561841885291866313950776660242655313839676;
    uint256 constant IC17y = 18804051937518972827006655122492102019462185877798006488779129652618312773295;
    
    uint256 constant IC18x = 17148886585222205590385767360696108087527767273695067616440243895986510971432;
    uint256 constant IC18y = 15917900073017321338778191005420281773971884542029918968910771314347829235865;
    
    uint256 constant IC19x = 14055106309353704034312213571114675190831056882264211913277122922262221195964;
    uint256 constant IC19y = 10847037571419083791424353586433181339462480833920804255034316763513849391894;
    
    uint256 constant IC20x = 19990054326243606855602041877909159832414217020935011618975907577016622891877;
    uint256 constant IC20y = 2317162820163556659198816553217306554427027025847500937211903980235619424093;
    
    uint256 constant IC21x = 21078545416596344602092880161962451222420729107466773874441769912802403816808;
    uint256 constant IC21y = 4719975737529990839434233360814679549519994009905082391495714857443369204028;
    
    uint256 constant IC22x = 18781579402347470791059606092386158257502502188299266960296851595783943107892;
    uint256 constant IC22y = 16310079479994472164476139709179577516722902990683864791058482026536088344477;
    
    uint256 constant IC23x = 21403685332916536536709339196223795792811667342809361269863077015260430615031;
    uint256 constant IC23y = 14885608716769779998706222853692177505914181293619178904053419395326471055252;
    
    uint256 constant IC24x = 15492320710496313888229866566966087005033345310030807225355952991466907440734;
    uint256 constant IC24y = 19449414459892269829758415048749605341806704715154363623777142443350668295866;
    
    uint256 constant IC25x = 16560973053024053910353043423565720872982926526765150985550620992526476269419;
    uint256 constant IC25y = 8286015376697943407298937459339490526567235555839485421690718409005533420432;
    
    uint256 constant IC26x = 5691826859547748683906872783340652529211344148550095970441716199408531612914;
    uint256 constant IC26y = 12806218538085034922850491597915385646334379301192036216658334920950019776491;
    
 
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
